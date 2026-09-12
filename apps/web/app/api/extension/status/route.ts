import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { meetings, captureSessions } from '@fathom/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const meetingUrl = searchParams.get('url')
  if (!meetingUrl) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const db = getDb()
  const [meeting] = await db.select().from(meetings)
    .where(and(eq(meetings.userId, session.user.id), eq(meetings.meetingUrl, meetingUrl)))
    .orderBy(desc(meetings.createdAt)).limit(1)

  if (!meeting) return NextResponse.json({ status: 'none', meeting: null })

  const [captureSession] = await db.select().from(captureSessions)
    .where(eq(captureSessions.meetingId, meeting.id))
    .orderBy(desc(captureSessions.createdAt)).limit(1)

  return NextResponse.json({
    meetingId: meeting.id,
    status: meeting.status,
    providerBotId: captureSession?.providerBotId,
    elapsedMs: meeting.actualStartedAt
      ? Date.now() - new Date(meeting.actualStartedAt).getTime()
      : null,
  })
}
