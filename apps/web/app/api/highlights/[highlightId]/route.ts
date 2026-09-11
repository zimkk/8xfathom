import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { highlights, meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

const UpdateHighlightSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  emoji: z.string().max(10).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ highlightId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { highlightId } = await params
  const db = getDb()

  const body = await request.json()
  const parsed = UpdateHighlightSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Verify ownership through meeting join
  const [highlight] = await db
    .select({ h: highlights, userId: meetings.userId })
    .from(highlights)
    .innerJoin(meetings, eq(highlights.meetingId, meetings.id))
    .where(and(eq(highlights.id, highlightId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!highlight) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [updated] = await db
    .update(highlights)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(highlights.id, highlightId))
    .returning()

  return NextResponse.json({ highlight: updated })
}

export async function DELETE(
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
    .select({ id: highlights.id })
    .from(highlights)
    .innerJoin(meetings, eq(highlights.meetingId, meetings.id))
    .where(and(eq(highlights.id, highlightId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.delete(highlights).where(eq(highlights.id, highlightId))
  return NextResponse.json({ ok: true })
}
