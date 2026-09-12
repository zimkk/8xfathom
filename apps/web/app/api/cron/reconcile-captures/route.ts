import { NextResponse } from 'next/server'
import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { waitUntil } from '@vercel/functions'

// Default 60s (Hobby). Recall getSession calls are ~100ms each so handles ~200 meetings per run.

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  const secret = process.env['CRON_SECRET']
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

const ACTIVE_STATUSES = ['bot_starting', 'waiting_for_admission', 'recording', 'ended', 'processing'] as const
type ActiveStatus = (typeof ACTIVE_STATUSES)[number]

async function runReconcile() {
  const db = getDb()

  const activeMeetings = await db
    .select({
      meetingId: meetings.id,
      status: meetings.status,
      providerBotId: captureSessions.providerBotId,
    })
    .from(meetings)
    .leftJoin(captureSessions, eq(captureSessions.meetingId, meetings.id))
    .where(inArray(meetings.status, [...ACTIVE_STATUSES] as ActiveStatus[]))

  const { RecallCaptureProvider } = await import('@fathom/integrations')
  const recall = new RecallCaptureProvider()

  for (const row of activeMeetings) {
    if (!row.providerBotId) continue
    try {
      const session = await recall.getSession(row.providerBotId)

      if (session.status === 'done' && !['ended', 'processing', 'ready'].includes(row.status)) {
        console.log(`[reconcile] Fixing stuck meeting ${row.meetingId}: provider=done local=${row.status}`)
        await db
          .update(meetings)
          .set({ status: 'ended', updatedAt: new Date() })
          .where(eq(meetings.id, row.meetingId))
      }
    } catch (err) {
      console.error(`[reconcile] Error checking ${row.meetingId}:`, err)
    }
  }

  return { checked: activeMeetings.length }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env['RECALL_API_KEY']) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no Recall key' })
  }

  waitUntil(runReconcile())
  return NextResponse.json({ ok: true, message: 'Reconciliation started' })
}
