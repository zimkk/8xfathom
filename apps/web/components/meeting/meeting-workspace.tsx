'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MeetingVideoPlayer } from './meeting-video-player'
import { OverviewTab } from './overview-tab'
import { TranscriptTab } from './transcript-tab'
import { AskTab } from './ask-tab'
import { MeetingStatusBanner } from './meeting-status-banner'
import { NotesFailedBanner } from './notes-failed-banner'
import { ShareDialog } from './share-dialog'
import { ParticipantAvatars } from './participant-avatars'
import { formatDuration } from '@/lib/utils'

interface Meeting {
  id: string
  title: string
  startsAt: Date | null
  durationMs: number | null
  status: string
  meetingUrl: string | null
  recordingStoragePath: string | null
  transcriptStatus: string
  processingErrorCode: string | null
}

interface Participant {
  id: string
  displayName: string
  email: string | null
  isHost: boolean
}

interface TranscriptSegment {
  id: string
  speakerName: string
  startMs: number
  endMs: number
  text: string
  sequence: number
}

interface Summary {
  overview: string
  templateKey: string
  structuredJson: unknown
}

interface ActionItem {
  id: string
  text: string
  ownerName: string | null
  dueDate: string | null
  status: string
  evidenceSegmentIds: string[]
}

interface Decision {
  id: string
  text: string
  status: string
  evidenceSegmentIds: string[]
}

interface Topic {
  id: string
  title: string
  summary: string | null
  startMs: number | null
  endMs: number | null
  sortOrder: number
}

interface Highlight {
  id: string
  title: string
  description: string | null
  startMs: number
  endMs: number
  type: string
}

interface MeetingWorkspaceProps {
  meeting: Meeting
  participants: Participant[]
  segments: TranscriptSegment[]
  summary: Summary | null
  actionItems: ActionItem[]
  decisions: Decision[]
  topics: Topic[]
  highlights: Highlight[]
  initialTimeSeconds?: number
  isDemo?: boolean
  isReadOnly?: boolean
  backHref?: string
  signedMediaUrl?: string
}

export function MeetingWorkspace({
  meeting,
  participants,
  segments,
  summary,
  actionItems,
  decisions,
  topics,
  highlights,
  initialTimeSeconds,
  isDemo,
  isReadOnly,
  backHref = '/app/meetings',
  signedMediaUrl,
}: MeetingWorkspaceProps) {
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const videoRef = useRef<HTMLVideoElement>(null)

  const seekTo = useCallback((ms: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ms / 1000
    }
  }, [])

  const isNonTerminal = !['ready', 'denied', 'failed', 'cancelled'].includes(meeting.status)

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={backHref}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-semibold text-base truncate">{meeting.title}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {meeting.startsAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(meeting.startsAt, 'MMM d, yyyy')}
                  </span>
                )}
                {meeting.durationMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(meeting.durationMs)}
                  </span>
                )}
                {participants.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {participants.length} attendees
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ParticipantAvatars participants={participants} max={4} />
            {!isDemo && !isReadOnly && <ShareDialog meetingId={meeting.id} />}
            {isDemo && (
              <Link href="/login">
                <Button size="sm" variant="outline">Sign in to share</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Status banner for non-terminal states */}
      {isNonTerminal && (
        <MeetingStatusBanner
          status={meeting.status}
          meetingId={meeting.id}
        />
      )}

      {/* Recording/transcript succeeded but AI notes failed to generate */}
      {meeting.status === 'ready' && meeting.processingErrorCode === 'summary_generation_failed' && !isDemo && !isReadOnly && (
        <NotesFailedBanner meetingId={meeting.id} />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video player */}
        <div className="flex flex-col border-r" style={{ width: '60%', minWidth: 0 }}>
          <div className="flex-1 bg-black flex items-center justify-center">
            <MeetingVideoPlayer
              ref={videoRef}
              src={signedMediaUrl}
              initialTimeSeconds={initialTimeSeconds}
              onTimeUpdate={setCurrentTimeMs}
            />
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="flex flex-col overflow-hidden" style={{ width: '40%', minWidth: 0 }}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            <div className="flex-shrink-0 border-b px-4 pt-3">
              <TabsList className="h-8 text-xs">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="transcript" className="text-xs">Transcript</TabsTrigger>
                <TabsTrigger value="ask" className="text-xs">Ask</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="overview" className="h-full m-0">
                <OverviewTab
                  meeting={meeting}
                  summary={summary}
                  actionItems={actionItems}
                  decisions={decisions}
                  topics={topics}
                  highlights={highlights}
                  segments={segments}
                  onSeek={seekTo}
                  isReadOnly={isDemo || isReadOnly}
                />
              </TabsContent>

              <TabsContent value="transcript" className="h-full m-0">
                <TranscriptTab
                  segments={segments}
                  currentTimeMs={currentTimeMs}
                  onSeek={seekTo}
                  meetingId={meeting.id}
                  isReadOnly={isDemo || isReadOnly}
                />
              </TabsContent>

              <TabsContent value="ask" className="h-full m-0">
                <AskTab
                  meetingId={meeting.id}
                  segments={segments}
                  onSeek={seekTo}
                  isDemo={isDemo}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
