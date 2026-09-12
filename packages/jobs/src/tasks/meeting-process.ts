import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import {
  meetings,
  transcriptSegments,
  meetingSummaries,
  actionItems,
  decisions,
  topics,
  meetingParticipants,
} from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

// DEPRECATED / NOT WIRED IN. The live meeting pipeline runs in apps/web/lib/services
// (recording-ingest-service → summary-generate-service), driven by the Recall webhook and the
// reconcile cron. This Trigger.dev task is retained only as a durable-queue reference for when
// summarization is moved off the request lifecycle; it is not imported anywhere at runtime.
// Keep it type-correct against @fathom/core so the workspace typecheck stays green.

const InputSchema = z.object({
  meetingId: z.string().uuid(),
  templateKey: z.enum(['general', 'sales', 'one_on_one', 'interview', 'project']).default('general'),
})

export const meetingProcessTask = task({
  id: 'meeting.process',
  maxDuration: 600,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const [meeting] = await db
      .select({ title: meetings.title })
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)
    if (!meeting) throw new Error(`Meeting not found ${input.meetingId}`)

    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, input.meetingId))
      .orderBy(transcriptSegments.startMs)

    if (segments.length === 0) {
      throw new Error(`No transcript segments for meeting ${input.meetingId}`)
    }

    const { OpenAIMeetingIntelligenceProvider } = await import('@fathom/integrations/ai')
    const ai = new OpenAIMeetingIntelligenceProvider()

    const extracted = await ai.extractMeeting({
      meetingId: input.meetingId,
      title: meeting.title,
      templateKey: input.templateKey,
      segments: segments.map((s) => ({
        id: s.id,
        speakerName: s.speakerName ?? 'Unknown',
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
    })

    await db
      .insert(meetingSummaries)
      .values({
        meetingId: input.meetingId,
        templateKey: input.templateKey,
        overview: extracted.overview,
        structuredJson: extracted,
        modelProvider: 'openai',
        modelName: process.env['AI_CHAT_MODEL'] ?? 'gpt-4o',
        promptVersion: 'v1',
      })
      .onConflictDoNothing()

    if (extracted.actionItems.length > 0) {
      await db.insert(actionItems).values(
        extracted.actionItems.map((item) => ({
          meetingId: input.meetingId,
          text: item.text,
          ownerName: item.ownerName,
          evidenceSegmentIds: item.evidenceSegmentIds,
          status: 'open' as const,
          source: 'ai' as const,
        }))
      )
    }

    if (extracted.decisions.length > 0) {
      await db.insert(decisions).values(
        extracted.decisions.map((d) => ({
          meetingId: input.meetingId,
          text: d.text,
          status: d.status,
          evidenceSegmentIds: d.evidenceSegmentIds,
        }))
      )
    }

    if (extracted.topics.length > 0) {
      await db.insert(topics).values(
        extracted.topics.map((t, i) => ({
          meetingId: input.meetingId,
          title: t.title,
          summary: t.summary,
          evidenceSegmentIds: t.evidenceSegmentIds,
          sortOrder: i,
        }))
      )
    }

    const speakerNames = [...new Set(segments.map((s) => s.speakerName).filter(Boolean))]
    if (speakerNames.length > 0) {
      await db
        .insert(meetingParticipants)
        .values(speakerNames.map((name) => ({ meetingId: input.meetingId, displayName: name! })))
        .onConflictDoNothing()
    }

    await db
      .update(meetings)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId))

    return { meetingId: input.meetingId, processed: true }
  },
})
