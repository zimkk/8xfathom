import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { validateGoogleMeetUrl, evaluateCaptureDecision } from '@fathom/core'
import { meetingLifecycle } from './meeting-lifecycle-service'

function getCaptureProvider() {
  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true') {
    return getMockCaptureProvider()
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RecallCaptureProvider } = require('@fathom/integrations') as typeof import('@fathom/integrations')
  return new RecallCaptureProvider()
}

function runMockLifecycle(meetingId: string, botId: string) {
  // Fire-and-forget lifecycle simulation — errors are swallowed intentionally
  setImmediate(async () => {
    try {
      const { getDb } = await import('@fathom/db')
      const { meetings, transcriptSegments, meetingSummaries } = await import('@fathom/db/schema')
      const { eq } = await import('drizzle-orm')
      const db = getDb()

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

      const setStatus = async (status: typeof meetings.$inferInsert['status']) => {
        if (status === 'recording') {
          await db.update(meetings).set({ status, updatedAt: new Date(), actualStartedAt: new Date() }).where(eq(meetings.id, meetingId))
        } else if (status === 'ended') {
          await db.update(meetings).set({ status, updatedAt: new Date(), actualEndedAt: new Date() }).where(eq(meetings.id, meetingId))
        } else {
          await db.update(meetings).set({ status, updatedAt: new Date() }).where(eq(meetings.id, meetingId))
        }
      }

      await delay(1000)
      await setStatus('bot_starting')
      await delay(1000)
      await setStatus('waiting_for_admission')
      await delay(1000)
      await setStatus('recording')
      await delay(5000)
      await setStatus('ended')
      await delay(500)
      await setStatus('processing')

      // Seed demo transcript segments
      const mockSegments = [
        { speakerName: 'Alice', startMs: 0, endMs: 8000, text: 'Thanks everyone for joining. Let\'s go over the Q3 roadmap updates.', sequence: 0 },
        { speakerName: 'Bob', startMs: 8500, endMs: 16000, text: 'The API integration is complete. We\'re ahead of schedule on the backend work.', sequence: 1 },
        { speakerName: 'Alice', startMs: 16500, endMs: 24000, text: 'Great. For the frontend, we need to finalize the dashboard by end of week.', sequence: 2 },
        { speakerName: 'Carol', startMs: 24500, endMs: 32000, text: 'I\'ll take ownership of the dashboard. Should be done by Thursday.', sequence: 3 },
        { speakerName: 'Bob', startMs: 32500, endMs: 40000, text: 'We also need to decide on the caching strategy. Redis or in-memory?', sequence: 4 },
        { speakerName: 'Alice', startMs: 40500, endMs: 48000, text: 'Let\'s go with Redis for now given scale requirements. We\'ll revisit next quarter.', sequence: 5 },
      ]

      await db.delete(transcriptSegments).where(eq(transcriptSegments.meetingId, meetingId))
      await db.insert(transcriptSegments).values(
        mockSegments.map((s) => ({ ...s, meetingId, source: 'recall' as const }))
      )

      // Seed a mock summary
      const existingSummary = await db.select({ id: meetingSummaries.id })
        .from(meetingSummaries).where(eq(meetingSummaries.meetingId, meetingId)).limit(1)

      if (existingSummary.length === 0) {
        await db.insert(meetingSummaries).values({
          meetingId,
          templateKey: 'general',
          version: 1,
          overview: 'Team reviewed Q3 roadmap progress. Backend API integration completed ahead of schedule. Dashboard work assigned to Carol with Thursday deadline. Redis selected as caching strategy.',
          structuredJson: {
            overview: 'Q3 roadmap review and planning session.',
            actionItems: [{ text: 'Finalize dashboard by Thursday', ownerName: 'Carol', evidenceSegmentIds: [] }],
            decisions: [{ text: 'Use Redis for caching', status: 'confirmed', evidenceSegmentIds: [] }],
            topics: [{ title: 'Q3 Roadmap Updates', summary: 'Backend ahead of schedule, frontend dashboard pending.', startMs: 0, endMs: 48000, evidenceSegmentIds: [], sortOrder: 0 }],
          },
          modelProvider: 'mock',
          modelName: 'mock',
          promptVersion: 'v1',
        })
      }

      await delay(500)
      await setStatus('ready')
      await db.update(meetings)
        .set({ transcriptStatus: 'complete', durationMs: 48000, updatedAt: new Date() })
        .where(eq(meetings.id, meetingId))

    } catch (err) {
      console.error('[mock lifecycle] error for meeting', meetingId, err)
    }
  })
}

function getMockCaptureProvider() {
  return {
    name: 'mock',
    async schedule({ meetingId }: { meetingId: string }) {
      const botId = `mock-bot-${Date.now()}`
      runMockLifecycle(meetingId, botId)
      return { providerSessionId: botId, providerBotId: botId }
    },
    async startNow({ meetingId }: { meetingId: string }) {
      const botId = `mock-bot-${Date.now()}`
      runMockLifecycle(meetingId, botId)
      return { providerSessionId: botId, providerBotId: botId }
    },
    async stop(_input: { providerSessionId: string }) {},
    async cancel(_input: { providerSessionId: string }) {},
    async getSession(providerSessionId: string) {
      return { providerSessionId, providerBotId: providerSessionId, status: 'recording' as const }
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
