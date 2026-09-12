import { getDb } from '@fathom/db'
import { meetings, transcriptSegments } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { runSummaryGenerate } from './summary-generate-service'

export async function runRecordingIngest(meetingId: string, recallBotId: string): Promise<void> {
  const db = getDb()

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)
  if (!meeting) {
    console.error('[recording-ingest] Meeting not found:', meetingId)
    return
  }

  const { RecallCaptureProvider } = await import('@fathom/integrations')
  const recall = new RecallCaptureProvider()

  const [session, transcript] = await Promise.all([
    recall.getSession(recallBotId),
    recall.getTranscript(recallBotId),
  ])

  // Store Recall's recording URL directly. It's valid for ~24h after the meeting ends.
  // On Vercel Pro, swap this for a download → Supabase re-upload so the URL never expires.
  if (session?.recordingUrl) {
    await db
      .update(meetings)
      .set({ recordingStoragePath: session.recordingUrl, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId))
  }

  // Only insert segments if not already populated by real-time webhook events
  if (transcript.length > 0) {
    const [existing] = await db
      .select({ id: transcriptSegments.id })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, meetingId))
      .limit(1)

    if (!existing) {
      await db.insert(transcriptSegments).values(
        transcript.map((seg, i) => ({
          meetingId,
          sequence: i,
          speakerName: seg.speaker,
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          source: 'recall' as const,
        })),
      )
    }
  }

  await db
    .update(meetings)
    .set({
      status: 'processing',
      transcriptStatus: 'complete',
      durationMs: transcript.length > 0 ? (transcript[transcript.length - 1]?.endMs ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, meetingId))

  // Chain directly into summary generation — no queue hop needed
  if (process.env['AI_API_KEY']) {
    try {
      await runSummaryGenerate(meetingId)
    } catch (err) {
      console.error('[recording-ingest] Summary generation failed:', err)
    }
  }
}
