import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Clock, Search } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getMeetingsForUser } from '@/lib/services/meeting-service'
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
          {allMeetings.map((meeting) => (
            <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
              <div className="flex items-center gap-4 rounded-[10px] border bg-white p-4 hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer">
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
                  </div>
                </div>
                <div className="shrink-0">
                  <Badge variant={getStatusVariant(meeting.status) as any} className="text-[10px]">
                    {MEETING_STATUS_LABELS[meeting.status as MeetingStatus] ?? meeting.status}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
