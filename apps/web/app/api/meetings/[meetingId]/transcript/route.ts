import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMeetingById, getTranscriptSegments } from '@/lib/services/meeting-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const session = await auth()
  const { meetingId } = await params

  const meeting = await getMeetingById(meetingId, session?.user?.id ?? undefined)
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const segments = await getTranscriptSegments(meetingId)
  return NextResponse.json({ segments })
}
