import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById, getTranscriptSegments } from '@/lib/services/meeting-service'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const AskSchema = z.object({
  question: z.string().min(1).max(500),
})

const STOPWORDS = new Set([
  'the', 'and', 'for', 'was', 'were', 'what', 'when', 'who', 'why', 'how', 'did', 'does',
  'are', 'this', 'that', 'with', 'about', 'from', 'they', 'them', 'you', 'your', 'our',
])

// Lightweight lexical retrieval: rank transcript segments by how many question keywords they
// contain, so questions about any part of the meeting work — not just the first 100 segments.
// (A proper embedding/vector search would supersede this; the pgvector pipeline isn't wired yet.)
function selectRelevantSegments<T extends { text: string; startMs: number }>(
  segments: T[],
  question: string,
  limit: number,
): T[] {
  if (segments.length <= limit) return segments

  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

  if (terms.length === 0) return segments.slice(0, limit)

  const scored = segments.map((s, index) => {
    const text = s.text.toLowerCase()
    let score = 0
    for (const term of terms) if (text.includes(term)) score++
    return { s, index, score }
  })

  const hits = scored.filter((x) => x.score > 0)
  const chosen = (hits.length > 0 ? hits : scored)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)

  // Restore chronological order so the model reads the excerpts coherently.
  return chosen.sort((a, b) => a.s.startMs - b.s.startMs).map((x) => x.s)
}

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

    const relevantSegments = selectRelevantSegments(segments, question, 100)
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
