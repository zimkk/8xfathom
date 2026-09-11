import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { transcriptSegments, embeddingChunks } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const InputSchema = z.object({
  meetingId: z.string().uuid(),
})

const CHUNK_SIZE = 5 // segments per chunk

export const embeddingsGenerateTask = task({
  id: 'embeddings.generate',
  maxDuration: 300,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.meetingId, input.meetingId))
      .orderBy(transcriptSegments.sequence)

    if (segments.length === 0) return { meetingId: input.meetingId, chunks: 0 }

    const { OpenAIMeetingIntelligenceProvider } = await import('@fathom/integrations/ai')
    const ai = new OpenAIMeetingIntelligenceProvider()

    // Create chunks of segments
    const chunks: string[] = []
    for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
      const chunk = segments.slice(i, i + CHUNK_SIZE)
      const text = chunk
        .map((s) => `${s.speakerName ?? 'Unknown'}: ${s.text}`)
        .join('\n')
      chunks.push(text)
    }

    // Embed all chunks
    const embeddings = await ai.embed(chunks)

    // Store embeddings
    const chunkRows = chunks.map((text, i) => ({
      meetingId: input.meetingId,
      chunkIndex: i,
      text,
      startMs: segments[i * CHUNK_SIZE]?.startMs ?? 0,
      endMs: segments[Math.min((i + 1) * CHUNK_SIZE - 1, segments.length - 1)]?.endMs ?? 0,
      // embedding stored separately via pgvector once schema supports it
      segmentIds: segments.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).map((s) => s.id),
    }))

    await db.insert(embeddingChunks).values(chunkRows).onConflictDoNothing()

    return { meetingId: input.meetingId, chunks: chunks.length }
  },
})
