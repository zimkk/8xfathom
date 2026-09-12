import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MeetingWorkspace } from '@/components/meeting/meeting-workspace'
import {
  getMeetingById,
  getMeetingParticipants,
  getTranscriptSegments,
  getMeetingSummary,
  getMeetingActionItems,
  getMeetingDecisions,
  getMeetingTopics,
  getMeetingHighlights,
  getActiveCaptureSession,
} from '@/lib/services/meeting-service'

interface PageProps {
  params: Promise<{ meetingId: string }>
  searchParams: Promise<{ t?: string; template?: string }>
}

export default async function MeetingPage({ params, searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { meetingId } = await params
  const { t, template } = await searchParams

  const meeting = await getMeetingById(meetingId, session.user.id)
  if (!meeting) notFound()

  // Verify ownership
  if (meeting.userId && meeting.userId !== session.user.id) notFound()

  const templateKey = template ?? meeting.summaryTemplateDefault ?? 'general'

  const [participants, segments, summary, actionItemsList, decisionsList, topicsList, highlightsList] =
    await Promise.all([
      getMeetingParticipants(meetingId),
      getTranscriptSegments(meetingId),
      getMeetingSummary(meetingId, templateKey),
      getMeetingActionItems(meetingId),
      getMeetingDecisions(meetingId),
      getMeetingTopics(meetingId),
      getMeetingHighlights(meetingId),
    ])

  // Get signed media URL if recording exists
  let signedMediaUrl: string | undefined
  if (meeting.recordingStoragePath) {
    try {
      const { getStorageProvider } = await import('@fathom/integrations')
      const storage = getStorageProvider()
      signedMediaUrl = await storage.getSignedUrl(meeting.recordingStoragePath, 3600)
    } catch {
      // storage not configured — video will show placeholder
    }
  }

  return (
    <MeetingWorkspace
      meeting={meeting}
      participants={participants}
      segments={segments}
      summary={summary}
      actionItems={actionItemsList}
      decisions={decisionsList}
      topics={topicsList}
      highlights={highlightsList}
      initialTimeSeconds={t ? parseFloat(t) : undefined}
      signedMediaUrl={signedMediaUrl}
      backHref="/app/meetings"
    />
  )
}
