import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { meetings, transcriptSegments, meetingParticipants, meetingSummaries } from '@fathom/db/schema'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const session = await auth()

  // Rate limit: 50 req/min per IP
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 'search', 50, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q ?? '', total: 0 })
  }

  const db = getDb()
  const results: Array<{
    meeting: { id: string; title: string; startsAt: string | null; durationMs: number | null }
    matchType: string
    snippet: string
    startMs?: number
    speakerName?: string
    score: number
  }> = []

  const userCondition = session?.user?.id
    ? or(eq(meetings.userId, session.user.id), eq(meetings.visibility, 'demo'))
    : eq(meetings.visibility, 'demo')

  // Title matches
  const titleMatches = await db
    .select({ id: meetings.id, title: meetings.title, startsAt: meetings.startsAt, durationMs: meetings.durationMs })
    .from(meetings)
    .where(and(userCondition, ilike(meetings.title, `%${q}%`)))
    .limit(5)

  for (const m of titleMatches) {
    results.push({
      meeting: {
        id: m.id,
        title: m.title,
        startsAt: m.startsAt?.toISOString() ?? null,
        durationMs: m.durationMs,
      },
      matchType: 'title',
      snippet: m.title,
      score: 1.0,
    })
  }

  // Transcript matches
  const matchedMeetingIds = new Set(results.map((r) => r.meeting.id))
  const transcriptMatches = await db
    .select({
      segId: transcriptSegments.id,
      text: transcriptSegments.text,
      speakerName: transcriptSegments.speakerName,
      startMs: transcriptSegments.startMs,
      meetingId: transcriptSegments.meetingId,
      title: meetings.title,
      startsAt: meetings.startsAt,
      durationMs: meetings.durationMs,
    })
    .from(transcriptSegments)
    .innerJoin(meetings, eq(transcriptSegments.meetingId, meetings.id))
    .where(and(userCondition, ilike(transcriptSegments.text, `%${q}%`)))
    .limit(limit)

  for (const match of transcriptMatches) {
    if (!matchedMeetingIds.has(match.meetingId)) {
      matchedMeetingIds.add(match.meetingId)
    }
    // Snippet with context around match
    const idx = match.text.toLowerCase().indexOf(q.toLowerCase())
    const start = Math.max(0, idx - 60)
    const end = Math.min(match.text.length, idx + q.length + 60)
    const snippet = (start > 0 ? '…' : '') + match.text.slice(start, end) + (end < match.text.length ? '…' : '')

    results.push({
      meeting: {
        id: match.meetingId,
        title: match.title,
        startsAt: match.startsAt?.toISOString() ?? null,
        durationMs: match.durationMs,
      },
      matchType: 'transcript',
      snippet,
      startMs: match.startMs,
      speakerName: match.speakerName,
      score: 0.8,
    })
  }

  // Participant matches
  const participantMatches = await db
    .select({
      meetingId: meetingParticipants.meetingId,
      displayName: meetingParticipants.displayName,
      title: meetings.title,
      startsAt: meetings.startsAt,
      durationMs: meetings.durationMs,
    })
    .from(meetingParticipants)
    .innerJoin(meetings, eq(meetingParticipants.meetingId, meetings.id))
    .where(and(userCondition, ilike(meetingParticipants.displayName, `%${q}%`)))
    .limit(5)

  for (const match of participantMatches) {
    if (matchedMeetingIds.has(match.meetingId)) continue
    matchedMeetingIds.add(match.meetingId)
    results.push({
      meeting: {
        id: match.meetingId,
        title: match.title,
        startsAt: match.startsAt?.toISOString() ?? null,
        durationMs: match.durationMs,
      },
      matchType: 'participant',
      snippet: match.displayName,
      score: 0.7,
    })
  }

  // Summary matches
  const summaryMatches = await db
    .select({
      meetingId: meetingSummaries.meetingId,
      overview: meetingSummaries.overview,
      title: meetings.title,
      startsAt: meetings.startsAt,
      durationMs: meetings.durationMs,
    })
    .from(meetingSummaries)
    .innerJoin(meetings, eq(meetingSummaries.meetingId, meetings.id))
    .where(and(userCondition, ilike(meetingSummaries.overview, `%${q}%`)))
    .limit(5)

  for (const match of summaryMatches) {
    if (matchedMeetingIds.has(match.meetingId)) continue
    matchedMeetingIds.add(match.meetingId)
    const idx = match.overview.toLowerCase().indexOf(q.toLowerCase())
    const start = Math.max(0, idx - 60)
    const end = Math.min(match.overview.length, idx + q.length + 60)
    const snippet = (start > 0 ? '…' : '') + match.overview.slice(start, end) + (end < match.overview.length ? '…' : '')

    results.push({
      meeting: {
        id: match.meetingId,
        title: match.title,
        startsAt: match.startsAt?.toISOString() ?? null,
        durationMs: match.durationMs,
      },
      matchType: 'summary',
      snippet,
      score: 0.75,
    })
  }

  return NextResponse.json({
    results: results.slice(0, limit),
    query: q,
    total: results.length,
  })
}
