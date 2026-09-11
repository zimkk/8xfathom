import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById, getTranscriptSegments } from '@/lib/services/meeting-service'
import { getDb } from '@fathom/db'
import { meetingSummaries } from '@fathom/db/schema'

const GenerateSchema = z.object({
  templateKey: z.enum(['general', 'sales', 'one_on_one', 'interview', 'project']).default('general'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { templateKey } = parsed.data
  const rawSegments = await getTranscriptSegments(meetingId)

  if (rawSegments.length === 0) {
    return NextResponse.json({ error: 'No transcript available' }, { status: 422 })
  }

  const segments = rawSegments.map((s) => ({
    id: s.id,
    speakerName: s.speakerName ?? 'Unknown',
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
  }))

  const { getAIProvider } = await import('@/lib/ai/provider')
  const ai = getAIProvider()

  const summary = await ai.generateSummary({
    meetingId,
    title: meeting.title,
    segments,
    templateKey,
  })

  const db = getDb()
  await db
    .insert(meetingSummaries)
    .values({
      meetingId,
      templateKey,
      overview: summary.overview,
      modelProvider: summary.modelProvider,
      modelName: summary.modelName,
      promptVersion: summary.promptVersion,
      structuredJson: summary,
    })
    .onConflictDoUpdate({
      target: [meetingSummaries.meetingId, meetingSummaries.templateKey, meetingSummaries.version],
      set: { overview: summary.overview, structuredJson: summary, updatedAt: new Date() },
    })

  return NextResponse.json({ summary, templateKey })
}
