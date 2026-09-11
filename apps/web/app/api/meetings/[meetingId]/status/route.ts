import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMeetingById, getActiveCaptureSession } from '@/lib/services/meeting-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  const { meetingId } = await params

  const meeting = await getMeetingById(meetingId, session?.user?.id ?? undefined)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const captureSession = await getActiveCaptureSession(meetingId)

  let elapsedMs = 0
  if (captureSession?.recordingStartedAt) {
    const ended = captureSession.recordingEndedAt ?? new Date()
    elapsedMs = ended.getTime() - captureSession.recordingStartedAt.getTime()
  }

  const canStop = meeting.status === 'recording' && !!captureSession
  const canHighlight = meeting.status === 'recording' && !!captureSession

  return NextResponse.json({
    id: meeting.id,
    status: meeting.status,
    elapsedMs,
    participantCount: 0,
    transcriptStatus: meeting.transcriptStatus,
    canStop,
    canHighlight,
  })
}
