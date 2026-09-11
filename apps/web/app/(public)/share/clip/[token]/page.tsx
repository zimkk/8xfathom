import { notFound } from 'next/navigation'
import { getDb } from '@fathom/db'
import { shareLinks, highlights } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { hashToken } from '@/lib/crypto/encryption'
import { getMeetingById, getTranscriptSegments } from '@/lib/services/meeting-service'
import { MeetingVideoPlayer } from '@/components/meeting/meeting-video-player'
import { Shield, Clock } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ShareClipPage({ params }: Props) {
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
          <p className="text-sm text-muted-foreground">The owner can create a new share link.</p>
        </div>
      </div>
    )
  }

  if (!link.highlightId) notFound()

  const [highlight] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, link.highlightId))
    .limit(1)

  if (!highlight) notFound()

  const [meeting, segments] = await Promise.all([
    getMeetingById(highlight.meetingId),
    getTranscriptSegments(highlight.meetingId),
  ])

  if (!meeting) notFound()

  const clipSegments = segments.filter(
    (s) => s.startMs >= highlight.startMs && s.endMs <= highlight.endMs
  )

  await db
    .update(shareLinks)
    .set({ updatedAt: new Date() })
    .where(eq(shareLinks.id, link.id))

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-muted/40 px-4 py-2 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Shared clip — view only</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">{highlight.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{meeting.title}</span>
            <span>·</span>
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTimestamp(highlight.startMs)} – {formatTimestamp(highlight.endMs)}</span>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden mb-6 bg-black aspect-video">
          <MeetingVideoPlayer
            src={meeting.recordingStoragePath ?? undefined}
            startMs={highlight.startMs}
            endMs={highlight.endMs}
          />
        </div>

        {clipSegments.length > 0 && (
          <div className="bg-muted/50 rounded-xl p-4">
            <h2 className="text-sm font-medium mb-3 text-muted-foreground">Transcript</h2>
            <div className="space-y-3">
              {clipSegments.map((seg) => (
                <div key={seg.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium">{seg.speakerName ?? 'Speaker'}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(seg.startMs)}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{seg.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
