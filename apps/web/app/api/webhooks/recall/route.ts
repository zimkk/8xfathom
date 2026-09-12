import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createHmac } from 'crypto'
import { getDb } from '@fathom/db'
import { meetings, captureSessions, transcriptSegments } from '@fathom/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { MeetingStatus } from '@fathom/core'

// Vercel Hobby: 60s cap. waitUntil budget: ~5s transcript fetch + ~30s OpenAI = well within limit.
// On Pro, set maxDuration = 300 and re-enable recording download in recording-ingest-service.ts.

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  const expected = hmac.digest('hex')
  if (signature.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

function recallStatusToMeetingStatus(code: string): MeetingStatus | null {
  const map: Record<string, MeetingStatus> = {
    joining_call: 'bot_starting',
    waiting_for_admission: 'waiting_for_admission',
    in_call_not_recording: 'bot_starting',
    in_call_recording: 'recording',
    call_ended: 'ended',
    done: 'ended',
    analysis_in_progress: 'processing',
    analysis_done: 'processing',
    error: 'failed',
    recording_permission_denied: 'failed',
    timeout_waiting_for_meeting_start: 'failed',
    timeout_waiting_for_admission: 'failed',
  }
  return map[code] ?? null
}

// Recall status codes where recording + transcript are fully available
const INGEST_TRIGGER_CODES = new Set(['analysis_done', 'done'])

type RecallWebhookEvent =
  | {
      event: 'bot.status_change'
      data: {
        bot_id: string
        status: { code: string; created_at: string; sub_code?: string }
        metadata?: Record<string, string>
      }
    }
  | {
      event: 'bot.transcript.data'
      data: {
        bot_id: string
        transcript: {
          speaker: string
          words: Array<{ start_time: number; end_time: number; text: string }>
          is_final: boolean
        }
      }
    }
  | {
      event: string
      data: { bot_id: string; [key: string]: unknown }
    }

export async function POST(request: Request) {
  const secret = process.env['RECALL_WEBHOOK_SECRET']
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-recall-signature') ?? ''

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: RecallWebhookEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = getDb()
  const { event: eventType, data } = event

  // Find the capture session by recall bot ID
  const [session] = await db
    .select({ meetingId: captureSessions.meetingId, id: captureSessions.id })
    .from(captureSessions)
    .where(eq(captureSessions.providerBotId, data.bot_id))
    .limit(1)

  if (!session) {
    // Bot may not be registered yet — return 200 to prevent retries
    return NextResponse.json({ ok: true, note: 'bot_not_found' })
  }

  const { meetingId } = session

  // --- bot.status_change ---
  if (eventType === 'bot.status_change' && 'status' in data && data.status) {
    const statusData = (data as Extract<RecallWebhookEvent, { event: 'bot.status_change' }>['data']).status
    const newStatus = recallStatusToMeetingStatus(statusData.code)

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

    // Only kick off ingest once Recall has finished all processing (recording + transcript ready)
    if (INGEST_TRIGGER_CODES.has(statusData.code) && process.env['USE_MOCK_INTEGRATIONS'] !== 'true') {
      const { runRecordingIngest } = await import('@/lib/services/recording-ingest-service')
      waitUntil(runRecordingIngest(meetingId, data.bot_id))
    }
  }

  // --- bot.transcript.data (real-time segments) ---
  if (eventType === 'bot.transcript.data') {
    const transcriptData = (data as Extract<RecallWebhookEvent, { event: 'bot.transcript.data' }>['data']).transcript

    if (transcriptData?.is_final && transcriptData.words?.length > 0) {
      const words = transcriptData.words
      const startMs = Math.round((words[0]?.start_time ?? 0) * 1000)
      const endMs = Math.round((words[words.length - 1]?.end_time ?? 0) * 1000)
      const text = words.map((w) => w.text).join(' ')

      // Get the current max sequence so we append correctly
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
        speakerName: transcriptData.speaker,
        startMs,
        endMs,
        text,
        source: 'recall',
      }).onConflictDoNothing()
    }
  }

  return NextResponse.json({ ok: true })
}
