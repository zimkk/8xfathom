import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { meetings, transcriptSegments, meetingSummaries, actionItems, decisions, topics } from '@fathom/db/schema'
import { eq, asc } from 'drizzle-orm'

const InputSchema = z.object({
  meetingId: z.string().uuid(),
  templateKey: z.enum(['general', 'sales', 'one_on_one', 'interview', 'project']).default('general'),
})

export const summaryGenerateTask = task({
  id: 'summary.generate',
  maxDuration: 300,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const segments = await db.select().from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, input.meetingId))
      .orderBy(asc(transcriptSegments.sequence))

    if (segments.length === 0) throw new Error('No transcript segments')

    const { OpenAIMeetingIntelligenceProvider } = await import('@fathom/integrations')
    const ai = new OpenAIMeetingIntelligenceProvider()

    const transcriptInput = segments.map((s) => ({
      id: s.id,
      speaker: s.speakerName ?? 'Unknown',
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    }))

    const extracted = await ai.extractMeeting({ transcript: transcriptInput, templateKey: input.templateKey })

    // Upsert summary
    const existing = await db.select({ id: meetingSummaries.id }).from(meetingSummaries)
      .where(eq(meetingSummaries.meetingId, input.meetingId))
      .limit(1)

    if (existing.length > 0) {
      await db.update(meetingSummaries)
        .set({
          overview: extracted.overview ?? extracted.summary,
          structuredJson: extracted,
          updatedAt: new Date(),
        })
        .where(eq(meetingSummaries.meetingId, input.meetingId))
    } else {
      await db.insert(meetingSummaries).values({
        meetingId: input.meetingId,
        templateKey: input.templateKey,
        version: 1,
        overview: extracted.overview ?? extracted.summary ?? '',
        structuredJson: extracted,
        modelProvider: 'openai',
        modelName: process.env['AI_CHAT_MODEL'] ?? 'gpt-4o',
        promptVersion: 'v1',
      })
    }

    // Insert action items
    if (extracted.actionItems?.length > 0) {
      await db.delete(actionItems).where(eq(actionItems.meetingId, input.meetingId))
      await db.insert(actionItems).values(
        extracted.actionItems.map((item: { text: string; ownerName?: string | null; evidenceSegmentIds?: string[] }) => ({
          meetingId: input.meetingId,
          text: item.text,
          ownerName: item.ownerName ?? null,
          evidenceSegmentIds: item.evidenceSegmentIds ?? [],
          source: 'ai' as const,
          status: 'open' as const,
        }))
      )
    }

    // Insert decisions
    if (extracted.decisions?.length > 0) {
      await db.delete(decisions).where(eq(decisions.meetingId, input.meetingId))
      await db.insert(decisions).values(
        extracted.decisions.map((d: { text: string; status?: 'confirmed' | 'tentative'; evidenceSegmentIds?: string[] }) => ({
          meetingId: input.meetingId,
          text: d.text,
          status: d.status ?? 'confirmed',
          evidenceSegmentIds: d.evidenceSegmentIds ?? [],
        }))
      )
    }

    // Insert topics
    if (extracted.topics?.length > 0) {
      await db.delete(topics).where(eq(topics.meetingId, input.meetingId))
      await db.insert(topics).values(
        extracted.topics.map((t: { title: string; summary?: string; startMs?: number; endMs?: number; evidenceSegmentIds?: string[] }, i: number) => ({
          meetingId: input.meetingId,
          title: t.title,
          summary: t.summary ?? '',
          startMs: t.startMs ?? 0,
          endMs: t.endMs ?? 0,
          evidenceSegmentIds: t.evidenceSegmentIds ?? [],
          sortOrder: i,
        }))
      )
    }

    // Mark meeting ready
    await db.update(meetings)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId))

    return { success: true }
  },
})
