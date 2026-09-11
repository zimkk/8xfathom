import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getMeetingById, getMeetingHighlights, createHighlight } from '@/lib/services/meeting-service'

const CreateHighlightSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  type: z.enum(['highlight', 'decision', 'action', 'moment']).default('highlight'),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  const { meetingId } = await params

  const meeting = await getMeetingById(meetingId, session?.user?.id ?? undefined)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const highlights = await getMeetingHighlights(meetingId)
  return NextResponse.json({ highlights })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (meeting.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = CreateHighlightSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { title, description, startMs, endMs, type } = parsed.data
  if (endMs <= startMs) {
    return NextResponse.json({ error: 'endMs must be greater than startMs' }, { status: 400 })
  }

  const highlight = await createHighlight({
    meetingId,
    userId: session.user.id,
    title,
    description,
    startMs,
    endMs,
    type,
    source: 'user',
  })

  return NextResponse.json({ highlight }, { status: 201 })
}
