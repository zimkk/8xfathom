import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById, getMeetingActionItems } from '@/lib/services/meeting-service'
import { getDb } from '@fathom/db'
import { actionItems } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const CreateSchema = z.object({
  text: z.string().min(1).max(500),
  ownerName: z.string().max(100).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const session = await auth()
  const { meetingId } = await params

  const meeting = await getMeetingById(meetingId, session?.user?.id ?? undefined)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await getMeetingActionItems(meetingId)
  return NextResponse.json({ actionItems: items })
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

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const db = getDb()
  const [item] = await db
    .insert(actionItems)
    .values({
      meetingId,
      text: parsed.data.text,
      ownerName: parsed.data.ownerName ?? null,
      source: 'user',
      status: 'open',
      evidenceSegmentIds: [],
    })
    .returning()

  return NextResponse.json({ actionItem: item }, { status: 201 })
}

export async function DELETE(
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
  await db.delete(actionItems).where(eq(actionItems.meetingId, meetingId))
  return NextResponse.json({ ok: true })
}
