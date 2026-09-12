import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { captureOrchestration } from '@/lib/services/capture-orchestration-service'
import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

const Schema = z.object({ meetingId: z.string().uuid() })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const db = getDb()
  const [meeting] = await db.select({ id: meetings.id }).from(meetings)
    .where(and(eq(meetings.id, parsed.data.meetingId), eq(meetings.userId, session.user.id))).limit(1)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await captureOrchestration.stopCapture(parsed.data.meetingId)
  return NextResponse.json({ success: true })
}
