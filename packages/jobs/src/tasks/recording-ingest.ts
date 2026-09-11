import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { meetings, transcriptSegments, captureSessionLogs } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const InputSchema = z.object({
  meetingId: z.string().uuid(),
  recallBotId: z.string(),
})

export const recordingIngestTask = task({
  id: 'recording.ingest',
  maxDuration: 300,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)

    if (!meeting) throw new Error(`Meeting not found: ${input.meetingId}`)

    // Import Recall provider
    const { RecallCaptureProvider } = await import('@fathom/integrations/recall')
    const recall = new RecallCaptureProvider()

    // Fetch recording and transcript from Recall
    const [session, transcript] = await Promise.all([
      recall.getSession(input.recallBotId),
      recall.getTranscript(input.recallBotId),
    ])

    // Store recording storage path
    if (session?.videoUrl) {
      await db
        .update(meetings)
        .set({ recordingStoragePath: session.videoUrl, updatedAt: new Date() })
        .where(eq(meetings.id, input.meetingId))
    }

    // Insert transcript segments
    if (transcript.length > 0) {
      const segments = transcript.map((seg, i) => ({
        meetingId: input.meetingId,
        sequence: i,
        speakerName: seg.speaker,
        startMs: seg.startMs,
        endMs: seg.endMs,
        text: seg.text,
      }))

      await db.insert(transcriptSegments).values(segments).onConflictDoNothing()
    }

    // Update meeting status to processing
    await db
      .update(meetings)
      .set({
        status: 'processing',
        transcriptStatus: 'complete',
        durationMs: transcript.length > 0
          ? transcript[transcript.length - 1]?.endMs ?? null
          : null,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, input.meetingId))

    // Trigger AI processing
    const { tasks } = await import('@trigger.dev/sdk/v3')
    await tasks.trigger('meeting.process', { meetingId: input.meetingId })

    return { meetingId: input.meetingId, segmentsCount: transcript.length }
  },
})
