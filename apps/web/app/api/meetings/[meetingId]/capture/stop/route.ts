import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMeetingById } from '@/lib/services/meeting-service'
import { captureOrchestration } from '@/lib/services/capture-orchestration-service'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { meetingId } = await params
  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (meeting.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await captureOrchestration.stopCapture(meetingId)
  return NextResponse.json(result)
}
