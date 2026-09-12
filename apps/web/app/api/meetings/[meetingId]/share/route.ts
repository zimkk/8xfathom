import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById } from '@/lib/services/meeting-service'
import { getDb } from '@fathom/db'
import { shareLinks } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateToken, hashToken } from '@/lib/crypto/encryption'

const CreateSchema = z.object({
  kind: z.enum(['meeting', 'clip']).default('meeting'),
  highlightId: z.string().uuid().optional(),
  allowTranscript: z.boolean().default(true),
  allowSummary: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (meeting.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const links = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.meetingId, meetingId), eq(shareLinks.status, 'active')))

  return NextResponse.json({ shareLinks: links })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (meeting.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const token = generateToken()
  const tokenHash = hashToken(token)

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const db = getDb()
  const [link] = await db
    .insert(shareLinks)
    .values({
      meetingId,
      highlightId: parsed.data.highlightId ?? null,
      createdByUserId: session.user.id,
      kind: parsed.data.kind,
      tokenHash,
      allowTranscript: parsed.data.allowTranscript,
      allowSummary: parsed.data.allowSummary,
      expiresAt,
    })
    .returning()

  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  const shareUrl = parsed.data.kind === 'clip'
    ? `${appUrl}/share/clip/${token}`
    : `${appUrl}/share/meeting/${token}`

  return NextResponse.json({ shareLink: link, token, url: shareUrl }, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (meeting.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const linkId = z.string().uuid().safeParse(body?.linkId)
  if (!linkId.success) return NextResponse.json({ error: 'linkId required' }, { status: 400 })

  const db = getDb()
  await db
    .update(shareLinks)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(and(eq(shareLinks.id, linkId.data), eq(shareLinks.meetingId, meetingId)))

  return NextResponse.json({ ok: true })
}
