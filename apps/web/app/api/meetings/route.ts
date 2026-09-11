import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { captureOrchestration } from '@/lib/services/capture-orchestration-service'
import { validateGoogleMeetUrl } from '@fathom/core'

const CreateMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  meetingUrl: z.string().refine(validateGoogleMeetUrl, 'Invalid Google Meet URL'),
  startsAt: z.string().datetime().optional(),
  immediate: z.boolean().default(false),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateMeetingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { title, meetingUrl, startsAt, immediate } = parsed.data
  const db = getDb()

  const [meeting] = await db
    .insert(meetings)
    .values({
      userId: session.user.id,
      title,
      meetingUrl,
      source: 'manual',
      status: 'scheduled',
      visibility: 'private',
      startsAt: startsAt ? new Date(startsAt) : new Date(),
    })
    .returning()

  if (!meeting) {
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }

  // Schedule or start capture
  if (immediate) {
    await captureOrchestration.startCaptureNow(meeting.id)
  } else {
    await captureOrchestration.scheduleCapture(meeting.id)
  }

  return NextResponse.json({ meeting }, { status: 201 })
}
