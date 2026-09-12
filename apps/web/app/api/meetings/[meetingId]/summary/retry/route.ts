import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMeetingById } from '@/lib/services/meeting-service'
import { runSummaryGenerate } from '@/lib/services/summary-generate-service'

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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await runSummaryGenerate(meetingId)
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to generate notes' }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
