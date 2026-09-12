import { task } from '@trigger.dev/sdk/v3'
import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq, inArray } from 'drizzle-orm'

const ACTIVE_STATUSES = ['bot_starting', 'waiting_for_admission', 'recording', 'ended', 'processing'] as const
type ActiveStatus = typeof ACTIVE_STATUSES[number]

export const captureReconcileTask = task({
  id: 'capture.reconcile',
  maxDuration: 120,
  async run() {
    const db = getDb()

    // Find meetings in non-terminal active states
    const activeMeetings = await db.select({
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
          console.log(`[reconcile] Meeting ${row.meetingId} provider=done local=${row.status}`)
          // Transition to ended to trigger downstream processing
          await db.update(meetings)
            .set({ status: 'ended', updatedAt: new Date() })
            .where(eq(meetings.id, row.meetingId))
        }
      } catch (e) {
        console.error(`[reconcile] Error checking ${row.meetingId}:`, e)
      }
    }

    return { checked: activeMeetings.length }
  },
})
