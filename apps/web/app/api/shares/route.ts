import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { shareLinks, meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateToken, hashToken } from '@/lib/crypto/encryption'

const CreateShareSchema = z.object({
  meetingId: z.string().uuid(),
  allowTranscript: z.boolean().default(true),
  allowSummary: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateShareSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { meetingId, allowTranscript, allowSummary, expiresAt } = parsed.data
  const db = getDb()

  // Verify ownership
  const [meeting] = await db
    .select({ id: meetings.id, userId: meetings.userId })
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  // Generate token
  const rawToken = generateToken(32)
  const tokenHash = hashToken(rawToken)

  const [shareLink] = await db
    .insert(shareLinks)
    .values({
      meetingId,
      createdByUserId: session.user.id,
      kind: 'meeting',
      tokenHash,
      status: 'active',
      allowTranscript,
      allowSummary,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    })
    .returning()

  const appUrl = process.env['APP_URL'] || 'http://localhost:3000'
  const shareUrl = `${appUrl}/share/meeting/${rawToken}`

  return NextResponse.json({ shareLink, shareUrl, token: rawToken }, { status: 201 })
}
