import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import { getDb } from '@fathom/db'
import { meetings, captureSessions, transcriptSegments } from '@fathom/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { MeetingStatus } from '@fathom/core'

// Vercel Hobby: 60s cap. waitUntil budget: ~5s transcript fetch + ~30s OpenAI = well within limit.
// On Pro, set maxDuration = 300 and re-enable recording download in recording-ingest-service.ts.

// Recall webhooks use the Svix signing scheme: secret is `whsec_<base64>`, signed content is
// `${id}.${timestamp}.${body}`, and the signature header carries space-separated `v1,<base64sig>` values.
// https://docs.recall.ai/docs/authenticating-requests-from-recallai
function verifySignature(payload: string, headers: Headers, secret: string): boolean {
  const msgId = headers.get('webhook-id') ?? headers.get('svix-id')
  const msgTimestamp = headers.get('webhook-timestamp') ?? headers.get('svix-timestamp')
  const sigHeader = headers.get('webhook-signature') ?? headers.get('svix-signature')
  if (!msgId || !msgTimestamp || !sigHeader) return false

  const base64Secret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  const key = Buffer.from(base64Secret, 'base64')
  const toSign = `${msgId}.${msgTimestamp}.${payload}`
  const expected = createHmac('sha256', key).update(toSign).digest('base64')
  const expectedBytes = Buffer.from(expected, 'base64')

  return sigHeader.split(' ').some((candidate) => {
    const [version, sig] = candidate.split(',')
    if (version !== 'v1' || !sig) return false
    const sigBytes = Buffer.from(sig, 'base64')
    if (sigBytes.length !== expectedBytes.length) return false
    return timingSafeEqual(sigBytes, expectedBytes)
  })
}

// Current Recall API sends one distinct event per bot status, not a single `bot.status_change`
// with a nested code. https://docs.recall.ai/docs/bot-status-change-events
const STATUS_EVENT_MAP: Record<string, MeetingStatus> = {
  'bot.joining_call': 'bot_starting',
  'bot.in_waiting_room': 'waiting_for_admission',
  'bot.in_call_not_recording': 'bot_starting',
  'bot.in_call_recording': 'recording',
  'bot.call_ended': 'ended',
  'bot.done': 'ended',
  'bot.fatal': 'failed',
  'bot.recording_permission_denied': 'failed',
}

type RecallEvent = {
  event: string
  data: {
    bot?: { id: string; metadata?: Record<string, string> }
    data?: {
      words?: Array<{ text: string; start_timestamp?: { relative: number }; end_timestamp?: { relative: number } }>
      participant?: { id: number; name: string | null }
      code?: string
      sub_code?: string | null
    }
  }
}

export async function POST(request: Request) {
  const secret = process.env['RECALL_WEBHOOK_SECRET']
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: RecallEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const botId = event.data.bot?.id
  if (!botId) {
    return NextResponse.json({ ok: true, note: 'no_bot_id' })
  }

  const db = getDb()

  const [session] = await db
    .select({ meetingId: captureSessions.meetingId, id: captureSessions.id })
    .from(captureSessions)
    .where(eq(captureSessions.providerBotId, botId))
    .limit(1)

  if (!session) {
    // Bot may not be registered yet — return 200 to prevent retries
    return NextResponse.json({ ok: true, note: 'bot_not_found' })
  }

  const { meetingId } = session

  // --- bot status events ---
  const newStatus = STATUS_EVENT_MAP[event.event]
  if (newStatus) {
    await db
      .update(meetings)
      .set({
        status: newStatus,
        ...(newStatus === 'recording' ? { actualStartedAt: new Date() } : {}),
        ...(newStatus === 'ended' ? { actualEndedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, meetingId))
  }

  // Transcript is ready to fetch and ingest once Recall finishes processing it
  if (event.event === 'transcript.done') {
    const { runRecordingIngest } = await import('@/lib/services/recording-ingest-service')
    waitUntil(runRecordingIngest(meetingId, botId))
  }

  // --- real-time finalized transcript segments ---
  if (event.event === 'transcript.data') {
    const words = event.data.data?.words ?? []
    if (words.length > 0) {
      const startMs = Math.round((words[0]?.start_timestamp?.relative ?? 0) * 1000)
      const endMs = Math.round((words[words.length - 1]?.end_timestamp?.relative ?? 0) * 1000)
      const text = words.map((w) => w.text).join(' ')

      const [last] = await db
        .select({ sequence: transcriptSegments.sequence })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.meetingId, meetingId))
        .orderBy(desc(transcriptSegments.sequence))
        .limit(1)

      const nextSeq = last ? last.sequence + 1 : 0

      await db.insert(transcriptSegments).values({
        meetingId,
        sequence: nextSeq,
        speakerName: event.data.data?.participant?.name ?? 'Unknown',
        startMs,
        endMs,
        text,
        source: 'recall',
      }).onConflictDoNothing()
    }
  }

  return NextResponse.json({ ok: true })
}
