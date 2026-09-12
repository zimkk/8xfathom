import { notFound } from 'next/navigation'
import { Suspense } from 'react'
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
} from '@/lib/services/meeting-service'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function DemoMeetingPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { t } = await searchParams

  const meeting = await getMeetingById(id)
  if (!meeting || meeting.visibility !== 'demo') {
    notFound()
  }

  const [participants, segments, summary, actionItemsList, decisionsList, topicsList, highlightsList] =
    await Promise.all([
      getMeetingParticipants(id),
      getTranscriptSegments(id),
      getMeetingSummary(id, 'general'),
      getMeetingActionItems(id),
      getMeetingDecisions(id),
      getMeetingTopics(id),
      getMeetingHighlights(id),
    ])

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
    <div className="min-h-screen bg-background">
      {/* Demo banner */}
      <div className="bg-primary/5 border-b border-primary/10 text-center py-2">
        <span className="text-xs text-primary/80">
          Demo workspace — read-only.{' '}
          <a href="/login" className="font-medium text-primary underline">
            Sign in
          </a>{' '}
          to use with your own meetings.
        </span>
      </div>

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
        isDemo={true}
        backHref="/demo"
      />
    </div>
  )
}
