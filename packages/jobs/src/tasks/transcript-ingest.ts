import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { meetings, transcriptSegments, meetingParticipants } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const InputSchema = z.object({
  meetingId: z.string().uuid(),
  recallBotId: z.string(),
})

export const transcriptIngestTask = task({
  id: 'transcript.ingest',
  maxDuration: 300,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const { RecallCaptureProvider } = await import('@fathom/integrations')
    const recall = new RecallCaptureProvider()
    const transcript = await recall.getTranscript(input.recallBotId)

    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript from provider')
    }

    // Upsert participants
    const speakerNames = [...new Set(transcript.map((s: { speaker: string }) => s.speaker))]
    for (const name of speakerNames) {
      await db.insert(meetingParticipants).values({
        meetingId: input.meetingId,
        displayName: name,
      }).onConflictDoNothing()
    }

    // Clear existing segments and re-insert
    await db.delete(transcriptSegments).where(eq(transcriptSegments.meetingId, input.meetingId))

    const segments = transcript.map((s: { speaker: string; startMs: number; endMs: number; text: string }, i: number) => ({
      meetingId: input.meetingId,
      speakerName: s.speaker,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      source: 'recall' as const,
      sequence: i,
    }))

    if (segments.length > 0) {
      await db.insert(transcriptSegments).values(segments)
    }

    await db.update(meetings)
      .set({ transcriptStatus: 'complete', updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId))

    return { segmentCount: segments.length }
  },
})
