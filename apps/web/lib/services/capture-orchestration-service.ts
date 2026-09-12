import { getDb } from '@fathom/db'
import { meetings, captureSessions, calendarEvents, userCapturePreferences, users } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { validateGoogleMeetUrl, evaluateCaptureDecision, classifyMeeting } from '@fathom/core'
import { RecallCaptureProvider } from '@fathom/integrations'
import { meetingLifecycle } from './meeting-lifecycle-service'

function getCaptureProvider() {
  return new RecallCaptureProvider()
}

export class CaptureOrchestrationService {
  async scheduleCapture(meetingId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDb()
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)

    if (!meeting) return { success: false, error: 'Meeting not found' }

    if (!meeting.meetingUrl || !validateGoogleMeetUrl(meeting.meetingUrl)) {
      return { success: false, error: 'Invalid Google Meet URL' }
    }

    const [prefs] = meeting.userId
      ? await db.select().from(userCapturePreferences).where(eq(userCapturePreferences.userId, meeting.userId)).limit(1)
      : []
    const [user] = meeting.userId
      ? await db.select({ email: users.email }).from(users).where(eq(users.id, meeting.userId)).limit(1)
      : []
    const [calendarEvent] = meeting.calendarEventId
      ? await db.select({ attendeeEmails: calendarEvents.attendeeEmails }).from(calendarEvents).where(eq(calendarEvents.id, meeting.calendarEventId)).limit(1)
      : []

    const decision = evaluateCaptureDecision({
      defaultMode: prefs?.defaultMode ?? 'all',
      classification: user ? classifyMeeting(calendarEvent?.attendeeEmails ?? [], user.email) : 'ambiguous',
      override: meeting.captureOverride,
      meetingUrl: meeting.meetingUrl,
      isCancelled: meeting.status === 'cancelled',
    })

    if (!decision.shouldCapture) {
      return { success: false, error: decision.reason }
    }

    try {
      const provider = getCaptureProvider()
      const session = await provider.schedule({
        meetingId,
        meetingUrl: meeting.meetingUrl,
        title: meeting.title,
        startAt: meeting.startsAt ?? new Date(),
        botDisplayName: 'Fathom Notetaker',
        metadata: {},
        consent: { enabled: false, message: '' },
      })

      await db.insert(captureSessions).values({
        meetingId,
        provider: 'recall',
        providerBotId: session.providerSessionId ?? session.providerBotId,
        status: 'scheduled',
      })

      await meetingLifecycle.transition(meetingId, 'bot_queued')
      return { success: true }
    } catch (err) {
      console.error('Failed to schedule capture:', err)
      return { success: false, error: 'Provider error' }
    }
  }

  async startCaptureNow(meetingId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDb()
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1)

    if (!meeting) return { success: false, error: 'Meeting not found' }
    if (!meeting.meetingUrl) return { success: false, error: 'No meeting URL' }

    try {
      const provider = getCaptureProvider()
      const session = await provider.startNow({
        meetingId,
        meetingUrl: meeting.meetingUrl,
        title: meeting.title,
        botDisplayName: 'Fathom Notetaker',
        metadata: {},
        consent: { enabled: false, message: '' },
      })

      await db.insert(captureSessions).values({
        meetingId,
        provider: 'recall',
        providerBotId: session.providerSessionId ?? session.providerBotId,
        status: 'joining',
      })

      await meetingLifecycle.transition(meetingId, 'bot_starting')
      return { success: true }
    } catch (err) {
      console.error('Failed to start capture:', err)
      return { success: false, error: 'Provider error' }
    }
  }

  async stopCapture(meetingId: string): Promise<{ success: boolean }> {
    const db = getDb()
    const [log] = await db
      .select()
      .from(captureSessions)
      .where(eq(captureSessions.meetingId, meetingId))
      .orderBy(captureSessions.createdAt)
      .limit(1)

    if (log?.providerBotId) {
      try {
        const provider = getCaptureProvider()
        await provider.stop({ providerSessionId: log.providerBotId })
      } catch (err) {
        console.error('Stop capture error:', err)
      }
    }

    await meetingLifecycle.transition(meetingId, 'ended')
    return { success: true }
  }
}

export const captureOrchestration = new CaptureOrchestrationService()
