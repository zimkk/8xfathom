import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById, getTranscriptSegments } from '@/lib/services/meeting-service'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const AskSchema = z.object({
  question: z.string().min(1).max(500),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  const { meetingId } = await params

  // Rate limiting: 30/min for authenticated users, 5/min for guests
  const ip = getClientIp(request)
  const limit = session?.user?.id ? 30 : 5
  if (!checkRateLimit(ip, 'ask', limit, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const meeting = await getMeetingById(meetingId, session?.user?.id ?? undefined)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const parsed = AskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { question } = parsed.data
  const segments = await getTranscriptSegments(meetingId)

  if (segments.length === 0) {
    return NextResponse.json({
      answer: 'No transcript is available for this meeting yet.',
      citations: [],
    })
  }

  // Check if AI is configured
  const aiApiKey = process.env['AI_API_KEY']
  if (!aiApiKey) {
    return NextResponse.json({
      answer:
        'AI answering requires a configured AI provider. This meeting has a full transcript — you can search it directly in the Transcript tab.',
      citations: [],
    })
  }

  // AI answering with real provider
  try {
    const { getAIProvider } = await import('@/lib/ai/provider')
    const ai = getAIProvider()

    const relevantSegments = segments.slice(0, 100)
    const answer = await ai.answerQuestion({
      meetingId,
      question,
      relevantSegments: relevantSegments.map((s) => ({
        id: s.id,
        speakerName: s.speakerName,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
    })

    return NextResponse.json(answer)
  } catch (error) {
    console.error('AI ask failed:', error)
    return NextResponse.json(
      { error: 'AI processing failed' },
      { status: 500 }
    )
  }
}
