import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMeetingById } from '@/lib/services/meeting-service'
import { captureOrchestration } from '@/lib/services/capture-orchestration-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const immediate = body?.immediate === true

  const result = immediate
    ? await captureOrchestration.startCaptureNow(meetingId)
    : await captureOrchestration.scheduleCapture(meetingId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
