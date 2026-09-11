import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { highlights, meetings, shareLinks } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateToken, hashToken } from '@/lib/crypto/encryption'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ highlightId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { highlightId } = await params
  const db = getDb()

  const [row] = await db
    .select({ highlight: highlights, userId: meetings.userId })
    .from(highlights)
    .innerJoin(meetings, eq(highlights.meetingId, meetings.id))
    .where(and(eq(highlights.id, highlightId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rawToken = generateToken(32)
  const tokenHash = hashToken(rawToken)

  const [link] = await db
    .insert(shareLinks)
    .values({
      highlightId,
      createdByUserId: session.user.id,
      kind: 'clip',
      tokenHash,
      status: 'active',
      allowTranscript: true,
      allowSummary: false,
    })
    .returning()

  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  const shareUrl = `${appUrl}/share/clip/${rawToken}`

  return NextResponse.json({ shareLink: link, shareUrl }, { status: 201 })
}
