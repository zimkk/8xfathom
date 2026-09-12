import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { actionItems, meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const PatchSchema = z.object({
  status: z.enum(['open', 'done']),
})

interface Params {
  params: Promise<{ meetingId: string; actionItemId: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId, actionItemId } = await params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const db = getDb()

  // Verify the meeting belongs to this user
  const [meeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [updated] = await db
    .update(actionItems)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(actionItems.id, actionItemId), eq(actionItems.meetingId, meetingId)))
    .returning({ id: actionItems.id, status: actionItems.status })

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId, actionItemId } = await params
  const db = getDb()

  const [meeting] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id)))
    .limit(1)

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db
    .delete(actionItems)
    .where(and(eq(actionItems.id, actionItemId), eq(actionItems.meetingId, meetingId)))

  return new NextResponse(null, { status: 204 })
}
