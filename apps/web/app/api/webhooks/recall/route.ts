import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import type { MeetingStatus } from '@fathom/core'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  const expected = hmac.digest('hex')
  // Constant-time compare
  if (signature.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// Maps Recall bot status to our MeetingStatus
function recallStatusToMeetingStatus(recallStatus: string): MeetingStatus | null {
  const map: Record<string, MeetingStatus> = {
    'joining_call': 'bot_starting',
    'waiting_for_admission': 'waiting_for_admission',
    'in_call_not_recording': 'bot_starting',
    'in_call_recording': 'recording',
    'call_ended': 'ended',
    'done': 'ended',
    'error': 'failed',
    'analysis_in_progress': 'processing',
    'analysis_done': 'processing',
  }
  return map[recallStatus] ?? null
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

  let event: {
    event: string
    data: {
      bot_id: string
      status?: { code: string; created_at: string; sub_code?: string }
      participant_count?: number
      metadata?: Record<string, string>
    }
  }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = getDb()
  const { event: eventType, data } = event
  const recallBotId = data.bot_id

  // Find the meeting by recall bot ID
  const [session] = await db
    .select({ meetingId: captureSessions.meetingId, id: captureSessions.id })
    .from(captureSessions)
    .where(eq(captureSessions.providerBotId, recallBotId))
    .limit(1)

  if (!session) {
    // Bot may not be registered yet — return 200 to prevent retries
    return NextResponse.json({ ok: true, note: 'bot_not_found' })
  }

  const { meetingId } = session

  if (eventType === 'bot.status_change' && data.status) {
    const newStatus = recallStatusToMeetingStatus(data.status.code)

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

      // Enqueue processing job when recording ends
      if (newStatus === 'ended' || newStatus === 'processing') {
        const { USE_MOCK_INTEGRATIONS } = process.env
        if (USE_MOCK_INTEGRATIONS !== 'true') {
          try {
            // @ts-expect-error - trigger.dev is an optional runtime dep
            const { tasks } = await import('@trigger.dev/sdk/v3')
            await tasks.trigger('recording.ingest', { meetingId, recallBotId })
          } catch (err) {
            console.error('Failed to trigger recording.ingest:', err)
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
