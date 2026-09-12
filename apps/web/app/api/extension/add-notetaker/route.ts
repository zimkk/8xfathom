import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { validateGoogleMeetUrl } from '@fathom/core'
import { captureOrchestration } from '@/lib/services/capture-orchestration-service'

const Schema = z.object({
  meetingUrl: z.string().refine(validateGoogleMeetUrl, 'Invalid Google Meet URL'),
  title: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { meetingUrl, title } = parsed.data
  const db = getDb()

  // Reuse existing meeting if URL matches
  const [existing] = await db.select().from(meetings)
    .where(and(eq(meetings.userId, session.user.id), eq(meetings.meetingUrl, meetingUrl)))
    .orderBy(desc(meetings.createdAt)).limit(1)

  let meetingId = existing?.id
  if (!meetingId) {
    const [created] = await db.insert(meetings).values({
      userId: session.user.id,
      title: title ?? 'Meeting via Extension',
      meetingUrl,
      source: 'manual',
      status: 'scheduled',
      captureEnabled: true,
      captureOverride: 'enabled',
      visibility: 'private',
    }).returning({ id: meetings.id })
    if (!created?.id) return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
    meetingId = created.id
  }

  const result = await captureOrchestration.startCaptureNow(meetingId)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ meetingId, status: 'bot_starting' })
}
