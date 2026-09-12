import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createHmac, timingSafeEqual, createHash } from 'crypto'
import { getDb } from '@fathom/db'
import { meetings, captureSessions, transcriptSegments, webhookEvents } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import type { MeetingStatus } from '@fathom/core'

// Vercel Hobby caps a route at 60s; without this export the default (~10s) would kill the
// waitUntil() ingest work mid-summary. On Pro, raise to 300 and re-enable the recording
// download in recording-ingest-service.ts.
export const maxDuration = 60

// Reject webhooks whose signed timestamp is older than this to blunt replay attacks (Svix guidance).
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000

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

  // Reject stale (replayed) deliveries
  const tsHeader = request.headers.get('webhook-timestamp') ?? request.headers.get('svix-timestamp')
  if (tsHeader) {
    const tsMs = Number(tsHeader) * 1000
    if (Number.isFinite(tsMs) && Math.abs(Date.now() - tsMs) > MAX_WEBHOOK_AGE_MS) {
      return NextResponse.json({ error: 'Stale webhook' }, { status: 401 })
    }
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

  // Idempotency: the Svix message id uniquely identifies a delivery. Recall retries on any
  // non-2xx or timeout, so record each id once and short-circuit re-deliveries — this prevents
  // duplicate transcript rows and double-triggered summary generation.
  const deliveryId = request.headers.get('webhook-id') ?? request.headers.get('svix-id')
  if (deliveryId) {
    try {
      await db.insert(webhookEvents).values({
        provider: 'recall',
        providerEventId: deliveryId,
        eventType: event.event ?? 'unknown',
        payloadHash: createHash('sha256').update(rawBody).digest('hex'),
        status: 'processed',
        processedAt: new Date(),
      })
    } catch {
      // Unique (provider, provider_event_id) violation → already handled this delivery.
      return NextResponse.json({ ok: true, note: 'duplicate' })
    }
  }

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

  // Finalize (fetch transcript → summarize → mark ready) when the call is done. We trigger on
  // both events because `transcript.done` is not guaranteed for every transcript provider, while
  // `bot.done` always fires. runRecordingIngest is idempotent, so triggering from either (or both)
  // is safe. This is the sole reliable path to a summary.
  if (event.event === 'transcript.done' || event.event === 'bot.done') {
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

      // Derive `sequence` from the segment's start time rather than a read-then-write counter.
      // Recall delivers transcript.data events concurrently, so a MAX(sequence)+1 lookup raced and
      // produced duplicate/mis-ordered rows. Callers order transcripts by startMs, so a
      // deterministic value here is race-free; duplicate deliveries are already filtered by the
      // webhook idempotency guard above.
      await db.insert(transcriptSegments).values({
        meetingId,
        sequence: startMs,
        speakerName: event.data.data?.participant?.name ?? 'Unknown',
        startMs,
        endMs,
        text,
        source: 'recall',
      })
    }
  }

  return NextResponse.json({ ok: true })
}
