import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Clock, Search, Users, CheckSquare } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getMeetingsForUser } from '@/lib/services/meeting-service'
import { getDb } from '@fathom/db'
import { meetingParticipants, actionItems, meetingSummaries } from '@fathom/db/schema'
import { and, inArray, sql } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/lib/utils'
import { MEETING_STATUS_LABELS } from '@fathom/core'
import type { MeetingStatus } from '@fathom/core'

export const metadata = { title: 'Meetings' }

export default async function MeetingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const allMeetings = await getMeetingsForUser(session.user.id, 50).catch(() => [])
  const meetingIds = allMeetings.map((m) => m.id)

  const [participantCounts, actionItemCounts, summaries] = meetingIds.length
    ? await Promise.all([
        getDb()
          .select({ meetingId: meetingParticipants.meetingId, count: sql<number>`count(*)::int` })
          .from(meetingParticipants)
          .where(inArray(meetingParticipants.meetingId, meetingIds))
          .groupBy(meetingParticipants.meetingId),
        getDb()
          .select({ meetingId: actionItems.meetingId, count: sql<number>`count(*)::int` })
          .from(actionItems)
          .where(inArray(actionItems.meetingId, meetingIds))
          .groupBy(actionItems.meetingId),
        getDb()
          .select({ meetingId: meetingSummaries.meetingId, overview: meetingSummaries.overview })
          .from(meetingSummaries)
          .where(and(inArray(meetingSummaries.meetingId, meetingIds), sql`${meetingSummaries.templateKey} = 'general'`)),
      ])
    : [[], [], []]

  const participantCountMap = new Map(participantCounts.map((p) => [p.meetingId, p.count]))
  const actionItemCountMap = new Map(actionItemCounts.map((a) => [a.meetingId, a.count]))
  const summaryMap = new Map(summaries.map((s) => [s.meetingId, s.overview]))

  function getStatusVariant(status: string) {
    if (status === 'recording') return 'destructive'
    if (status === 'ready') return 'success'
    if (status === 'processing') return 'purple'
    if (['bot_queued', 'bot_starting', 'waiting_for_admission'].includes(status)) return 'warning'
    return 'secondary'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Meetings</h1>
        <div className="flex items-center gap-2">
          <Link href="/app/search">
            <Button variant="outline" size="sm" className="gap-2">
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
          </Link>
          <Link href="/app/meetings/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Notetaker
            </Button>
          </Link>
        </div>
      </div>

      {allMeetings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm">No meetings yet.</p>
          <Link href="/app/settings/calendar" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Connect Google Calendar</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {allMeetings.map((meeting) => {
            const participantCount = participantCountMap.get(meeting.id) ?? 0
            const actionItemCount = actionItemCountMap.get(meeting.id) ?? 0
            const summaryPreview = summaryMap.get(meeting.id)

            return (
              <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
                <div className="rounded-[10px] border bg-white p-4 hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {meeting.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {meeting.startsAt && (
                          <span>{format(meeting.startsAt, 'MMM d, yyyy · h:mm a')}</span>
                        )}
                        {meeting.durationMs && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(meeting.durationMs)}
                          </span>
                        )}
                        {participantCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {participantCount}
                          </span>
                        )}
                        {actionItemCount > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            {actionItemCount} action item{actionItemCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Badge variant={getStatusVariant(meeting.status) as any} className="text-[10px]">
                        {MEETING_STATUS_LABELS[meeting.status as MeetingStatus] ?? meeting.status}
                      </Badge>
                    </div>
                  </div>
                  {summaryPreview && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{summaryPreview}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
