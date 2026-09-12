import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { meetings, userCapturePreferences, captureSessions } from '@fathom/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

const InputSchema = z.object({
  userId: z.string().uuid(),
})

export const captureScheduleTask = task({
  id: 'capture.schedule-upcoming',
  maxDuration: 120,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const now = new Date()
    const lookahead = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Get user preferences
    const [prefs] = await db.select().from(userCapturePreferences)
      .where(eq(userCapturePreferences.userId, input.userId)).limit(1)

    if (!prefs || prefs.defaultMode === 'none') return { scheduled: 0 }

    // Find upcoming meetings in scheduled state
    const upcomingMeetings = await db.select().from(meetings)
      .where(and(
        eq(meetings.userId, input.userId),
        eq(meetings.status, 'scheduled'),
        eq(meetings.captureEnabled, true),
        gte(meetings.startsAt, now),
        lte(meetings.startsAt, lookahead),
      ))

    let scheduled = 0
    for (const meeting of upcomingMeetings) {
      if (!meeting.meetingUrl) continue

      // Check if already has a capture session
      const [existingSession] = await db.select({ id: captureSessions.id })
        .from(captureSessions)
        .where(eq(captureSessions.meetingId, meeting.id))
        .limit(1)
      if (existingSession) continue

      try {
        const { RecallCaptureProvider } = await import('@fathom/integrations')
        const recall = new RecallCaptureProvider()
        const session = await recall.schedule({
          meetingId: meeting.id,
          meetingUrl: meeting.meetingUrl,
          title: meeting.title,
          startAt: meeting.startsAt ?? new Date(),
          botDisplayName: 'Fathom Notetaker',
          metadata: {},
          consent: { enabled: false, message: '' },
        })

        await db.insert(captureSessions).values({
          meetingId: meeting.id,
          provider: 'recall',
          providerBotId: session.providerSessionId,
          status: 'scheduled',
        })

        scheduled++
      } catch (e) {
        console.error('Failed to schedule capture for', meeting.id, e)
      }
    }

    return { scheduled }
  },
})
