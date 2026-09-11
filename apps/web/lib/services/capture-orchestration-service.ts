import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { validateGoogleMeetUrl, evaluateCaptureDecision } from '@fathom/core'
import { meetingLifecycle } from './meeting-lifecycle-service'

function getCaptureProvider() {
  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true') {
    return getMockCaptureProvider()
  }
  const { RecallCaptureProvider } = require('@fathom/integrations/recall')
  return new RecallCaptureProvider()
}

function getMockCaptureProvider() {
  return {
    name: 'mock',
    async schedule() {
      return { providerBotId: `mock-bot-${Date.now()}`, status: 'scheduled' }
    },
    async startNow() {
      return { providerBotId: `mock-bot-${Date.now()}`, status: 'joining' }
    },
    async stop() {},
    async cancel() {},
    async getSession(botId: string) {
      return { providerBotId: botId, status: 'in_call_recording' }
    },
  }
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

    const decision = evaluateCaptureDecision({
      defaultMode: 'all',
      classification: 'ambiguous',
      override: 'inherit',
      meetingUrl: meeting.meetingUrl,
      isCancelled: false,
    })

    if (!decision.shouldCapture) {
      return { success: false, error: decision.reason }
    }

    try {
      const provider = getCaptureProvider()
      const session = await provider.schedule({
        meetingId,
        meetingUrl: meeting.meetingUrl,
        scheduledStart: meeting.startsAt ?? new Date(),
      })

      await db.insert(captureSessions).values({
        meetingId,
        provider: provider.name,
        providerBotId: session.providerBotId,
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
      })

      await db.insert(captureSessions).values({
        meetingId,
        provider: provider.name,
        providerBotId: session.providerBotId,
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
        await provider.stop(log.providerBotId)
      } catch (err) {
        console.error('Stop capture error:', err)
      }
    }

    await meetingLifecycle.transition(meetingId, 'ended')
    return { success: true }
  }
}

export const captureOrchestration = new CaptureOrchestrationService()
