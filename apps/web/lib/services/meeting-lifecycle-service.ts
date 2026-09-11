import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { isValidMeetingTransition } from '@fathom/core'
import type { MeetingStatus } from '@fathom/core'

export class MeetingLifecycleService {
  async transition(meetingId: string, toStatus: MeetingStatus): Promise<boolean> {
    const db = getDb()
    const [meeting] = await db
      .select({ id: meetings.id, status: meetings.status })
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)

    if (!meeting) return false

    if (!isValidMeetingTransition(meeting.status as MeetingStatus, toStatus)) {
      console.warn(`Invalid transition ${meeting.status} -> ${toStatus} for meeting ${meetingId}`)
      return false
    }

    const updates: Partial<typeof meetings.$inferInsert> = {
      status: toStatus,
      updatedAt: new Date(),
    }

    if (toStatus === 'recording') {
      updates.actualStartedAt = new Date()
    } else if (toStatus === 'ended') {
      updates.actualEndedAt = new Date()
    }

    await db.update(meetings).set(updates).where(eq(meetings.id, meetingId))
    return true
  }

  async forceStatus(meetingId: string, status: MeetingStatus): Promise<void> {
    const db = getDb()
    await db
      .update(meetings)
      .set({ status, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId))
  }
}

export const meetingLifecycle = new MeetingLifecycleService()
