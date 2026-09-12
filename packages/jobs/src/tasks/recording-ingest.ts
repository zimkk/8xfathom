import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { meetings, transcriptSegments } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const InputSchema = z.object({
  meetingId: z.string().uuid(),
  recallBotId: z.string(),
})

export const recordingIngestTask = task({
  id: 'recording.ingest',
  maxDuration: 600,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, input.meetingId))
      .limit(1)

    if (!meeting) throw new Error(`Meeting not found: ${input.meetingId}`)

    const { RecallCaptureProvider, getStorageProvider } = await import('@fathom/integrations')
    const recall = new RecallCaptureProvider()

    const [session, transcript] = await Promise.all([
      recall.getSession(input.recallBotId),
      recall.getTranscript(input.recallBotId),
    ])

    // Download recording from Recall's temporary URL → re-upload to Supabase
    if (session?.recordingUrl) {
      try {
        const videoRes = await fetch(session.recordingUrl)
        if (videoRes.ok) {
          const buffer = Buffer.from(await videoRes.arrayBuffer())
          const storagePath = `meetings/${input.meetingId}/recording.mp4`
          const storage = getStorageProvider()
          await storage.uploadFile(storagePath, buffer, 'video/mp4')
          await db
            .update(meetings)
            .set({ recordingStoragePath: storagePath, updatedAt: new Date() })
            .where(eq(meetings.id, input.meetingId))
        }
      } catch (err) {
        console.error('[recording-ingest] Failed to download/upload recording:', err)
        // Non-fatal — continue with transcript processing
      }
    }

    // Insert transcript segments (skip if already populated by real-time events)
    if (transcript.length > 0) {
      const existing = await db
        .select({ id: transcriptSegments.id })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.meetingId, input.meetingId))
        .limit(1)

      if (existing.length === 0) {
        const segments = transcript.map((seg, i) => ({
          meetingId: input.meetingId,
          sequence: i,
          speakerName: seg.speaker,
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          source: 'recall' as const,
        }))
        await db.insert(transcriptSegments).values(segments).onConflictDoNothing()
      }
    }

    await db
      .update(meetings)
      .set({
        status: 'processing',
        transcriptStatus: 'complete',
        durationMs: transcript.length > 0
          ? (transcript[transcript.length - 1]?.endMs ?? null)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, input.meetingId))

    const { tasks } = await import('@trigger.dev/sdk/v3')
    await tasks.trigger('summary.generate', { meetingId: input.meetingId })

    return { meetingId: input.meetingId, segmentsCount: transcript.length }
  },
})
