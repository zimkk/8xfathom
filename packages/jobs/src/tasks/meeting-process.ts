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
  highlights,
  meetingParticipants,
} from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

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

    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, input.meetingId))
      .orderBy(transcriptSegments.sequence)

    if (segments.length === 0) {
      throw new Error(`No transcript segments for meeting ${input.meetingId}`)
    }

    const { OpenAIMeetingIntelligenceProvider } = await import('@fathom/integrations/ai')
    const ai = new OpenAIMeetingIntelligenceProvider()

    const transcriptInput = segments.map((s) => ({
      speaker: s.speakerName ?? 'Unknown',
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    }))

    const extracted = await ai.extractMeeting({
      transcript: transcriptInput,
      templateKey: input.templateKey,
    })

    // Update meeting title if extracted
    if (extracted.title) {
      await db
        .update(meetings)
        .set({ title: extracted.title })
        .where(eq(meetings.id, input.meetingId))
    }

    // Insert summary
    if (extracted.summary || extracted.keyPoints) {
      await db
        .insert(meetingSummaries)
        .values({
          meetingId: input.meetingId,
          templateKey: input.templateKey,
          overview: extracted.summary ?? '',
          structuredJson: { keyPoints: extracted.keyPoints ?? [] },
          modelProvider: 'openai',
          modelName: process.env['AI_CHAT_MODEL'] ?? 'gpt-4o',
          promptVersion: 'v1',
        })
        .onConflictDoNothing()
    }

    // Insert action items
    if (extracted.actionItems?.length > 0) {
      await db.insert(actionItems).values(
        extracted.actionItems.map((item: { text: string; ownerName?: string }) => ({
          meetingId: input.meetingId,
          text: item.text,
          ownerName: item.ownerName ?? null,
          status: 'open' as const,
          source: 'ai' as const,
        }))
      )
    }

    // Insert decisions
    if (extracted.decisions?.length > 0) {
      await db.insert(decisions).values(
        extracted.decisions.map((d: { text: string; status: string }) => ({
          meetingId: input.meetingId,
          text: d.text,
          status: (d.status ?? 'confirmed') as 'confirmed' | 'tentative',
        }))
      )
    }

    // Insert topics
    if (extracted.topics?.length > 0) {
      await db.insert(topics).values(
        extracted.topics.map((t: { title: string; startMs: number; endMs: number }, i: number) => ({
          meetingId: input.meetingId,
          title: t.title,
          startMs: t.startMs,
          endMs: t.endMs,
          sortOrder: i,
        }))
      )
    }

    // Insert highlights
    if (extracted.highlights?.length > 0) {
      await db.insert(highlights).values(
        extracted.highlights.map((h: { text: string; startMs: number; endMs: number }) => ({
          meetingId: input.meetingId,
          title: h.text,
          startMs: h.startMs,
          endMs: h.endMs,
          type: 'highlight' as const,
          source: 'ai' as const,
        }))
      )
    }

    // Extract unique speakers and upsert participants
    const speakerNames = [...new Set(segments.map((s) => s.speakerName).filter(Boolean))]
    if (speakerNames.length > 0) {
      await db.insert(meetingParticipants).values(
        speakerNames.map((name) => ({
          meetingId: input.meetingId,
          displayName: name!,
        }))
      ).onConflictDoNothing()
    }

    // Mark meeting as ready
    await db
      .update(meetings)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId))

    // Generate embeddings asynchronously
    const { tasks } = await import('@trigger.dev/sdk/v3')
    await tasks.trigger('embeddings.generate', { meetingId: input.meetingId })

    return { meetingId: input.meetingId, processed: true }
  },
})
