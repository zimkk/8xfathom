import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { highlights, meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

const Schema = z.object({
  meetingId: z.string().uuid(),
  elapsedMs: z.number().int().min(0),
  title: z.string().default('Live Highlight'),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { meetingId, elapsedMs, title } = parsed.data
  const db = getDb()

  const [meeting] = await db.select().from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, session.user.id))).limit(1)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const startMs = Math.max(0, elapsedMs - 15000)
  const endMs = elapsedMs + 15000

  const [highlight] = await db.insert(highlights).values({
    meetingId,
    userId: session.user.id,
    title,
    startMs,
    endMs,
    type: 'moment',
    source: 'extension',
  }).returning()

  return NextResponse.json({ highlight })
}
