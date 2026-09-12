import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

const PatchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  captureOverride: z.enum(['inherit', 'enabled', 'disabled']).optional(),
  summaryTemplateDefault: z.enum(['general', 'sales', 'one_on_one', 'interview', 'project']).optional(),
})

interface Params { params: Promise<{ meetingId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { meetingId } = await params
  const db = getDb()
  const [meeting] = await db.select().from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id))).limit(1)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ meeting })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { meetingId } = await params
  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const db = getDb()
  const [meeting] = await db.select({ id: meetings.id }).from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id))).limit(1)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const [updated] = await db.update(meetings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId))
    .returning()
  return NextResponse.json({ meeting: updated })
}
