import { notFound } from 'next/navigation'
import { getDb } from '@fathom/db'
import { shareLinks } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { hashToken } from '@/lib/crypto/encryption'
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
import { MeetingWorkspace } from '@/components/meeting/meeting-workspace'
import { Shield } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ShareMeetingPage({ params }: Props) {
  const { token } = await params
  const db = getDb()
  const tokenHash = hashToken(token)

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash))
    .limit(1)

  if (!link || link.status !== 'active') {
    notFound()
  }

  if (link.expiresAt && new Date() > link.expiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center py-12">
          <Shield className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h1 className="text-xl font-semibold mb-2">This link has expired</h1>
          <p className="text-sm text-muted-foreground">The owner can create a new share link from the meeting page.</p>
        </div>
      </div>
    )
  }

  if (!link.meetingId) notFound()

  const [meeting, participants, segments, summary, actionItems, decisions, topics, highlights] = await Promise.all([
    getMeetingById(link.meetingId),
    getMeetingParticipants(link.meetingId),
    link.allowTranscript ? getTranscriptSegments(link.meetingId) : Promise.resolve([]),
    link.allowSummary ? getMeetingSummary(link.meetingId) : Promise.resolve(null),
    link.allowSummary ? getMeetingActionItems(link.meetingId) : Promise.resolve([]),
    link.allowSummary ? getMeetingDecisions(link.meetingId) : Promise.resolve([]),
    link.allowSummary ? getMeetingTopics(link.meetingId) : Promise.resolve([]),
    getMeetingHighlights(link.meetingId),
  ])

  if (!meeting) notFound()

  await db
    .update(shareLinks)
    .set({ updatedAt: new Date() })
    .where(eq(shareLinks.id, link.id))

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
    <div className="flex flex-col min-h-screen">
      <div className="border-b bg-muted/40 px-4 py-2 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Shared meeting — view only</span>
      </div>
      <div className="flex-1">
        <MeetingWorkspace
          meeting={meeting}
          participants={participants}
          segments={link.allowTranscript ? segments : []}
          summary={link.allowSummary ? summary : null}
          actionItems={link.allowSummary ? actionItems : []}
          decisions={link.allowSummary ? decisions : []}
          topics={link.allowSummary ? topics : []}
          highlights={highlights}
          signedMediaUrl={signedMediaUrl}
          isReadOnly={true}
          backHref="/demo"
        />
      </div>
    </div>
  )
}
