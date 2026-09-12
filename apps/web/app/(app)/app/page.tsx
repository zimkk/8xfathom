import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Calendar, Clock, Users, ArrowRight, AlertTriangle } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getMeetingsForUser } from '@/lib/services/meeting-service'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantAvatars } from '@/components/meeting/participant-avatars'
import { CaptureToggle } from '@/components/meeting/capture-toggle'
import { formatDuration, meetingStatusVariant } from '@/lib/utils'
import { MEETING_STATUS_LABELS } from '@fathom/core'
import type { MeetingStatus } from '@fathom/core'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [allMeetings, [connection]] = await Promise.all([
    getMeetingsForUser(session.user.id, 20).catch(() => []),
    getDb().select({ status: calendarConnections.status }).from(calendarConnections).where(eq(calendarConnections.userId, session.user.id)).limit(1),
  ])
  const needsReauth = connection?.status === 'needs_reauth' || connection?.status === 'error'
  const isConnected = connection?.status === 'connected'

  const now = new Date()
  const upcomingMeetings = allMeetings.filter(
    (m) => m.startsAt && m.startsAt > now && ['scheduled', 'bot_queued', 'bot_starting', 'waiting_for_admission'].includes(m.status)
  )
  const recentMeetings = allMeetings.filter(
    (m) => m.status === 'ready' || m.status === 'processing'
  ).slice(0, 5)
  const activeMeetings = allMeetings.filter((m) => m.status === 'recording')

  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? `Good morning, ${firstName}` :
    hour < 17 ? `Good afternoon, ${firstName}` :
    `Good evening, ${firstName}`

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <Link href="/app/meetings/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Notetaker
          </Button>
        </Link>
      </div>

      {/* Active recording */}
      {activeMeetings.map((meeting) => (
        <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
          <div className="mb-4 rounded-[12px] border-2 border-red-200 bg-red-50 p-4 flex items-center gap-3 cursor-pointer hover:border-red-300 transition-colors">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 recording-dot shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-red-900">{meeting.title}</p>
              <p className="text-xs text-red-700">Recording in progress</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
              View live
            </Button>
          </div>
        </Link>
      ))}

      {/* Calendar needs reconnecting */}
      {needsReauth && (
        <div className="border border-amber-200 rounded-xl p-5 mb-6 bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900">Reconnect Google Calendar</p>
            <p className="text-sm text-amber-800 mt-0.5">
              We can no longer see your upcoming meetings. Your past meetings are still available below.
            </p>
            <Link href="/api/calendar/connect" className="inline-block mt-3 text-sm font-medium text-amber-900 hover:underline">
              Reconnect →
            </Link>
          </div>
        </div>
      )}

      {/* Empty state — tailored to whether the calendar is already connected */}
      {allMeetings.length === 0 && !needsReauth && (
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            {isConnected ? (
              <>
                <h3 className="font-semibold mb-1">No meetings yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your calendar is connected. Upcoming Google Meet calls will appear here — or sync now to fetch them.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href="/app/settings/calendar">
                    <Button size="sm">Sync calendar</Button>
                  </Link>
                  <Link href="/app/meetings/new">
                    <Button variant="outline" size="sm">Add a Meet manually</Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-1">Connect your calendar</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Discover upcoming Google Meet calls and schedule your notetaker automatically.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href="/app/settings/calendar">
                    <Button size="sm">Connect Google Calendar</Button>
                  </Link>
                  <Link href="/app/meetings/new">
                    <Button variant="outline" size="sm">Add a Meet manually</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming meetings */}
      {upcomingMeetings.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Upcoming Today
            </h2>
            <Link href="/app/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingMeetings.slice(0, 3).map((meeting) => (
              <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
                <div className="flex items-center gap-3 rounded-[10px] border bg-white p-3.5 hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="shrink-0 text-center">
                    {meeting.startsAt && (
                      <>
                        <p className="text-xs font-semibold text-primary">{format(meeting.startsAt, 'h:mm')}</p>
                        <p className="text-[10px] text-muted-foreground">{format(meeting.startsAt, 'a')}</p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{meeting.title}</p>
                    <Badge variant={meetingStatusVariant(meeting.status)} className="text-[10px] mt-0.5">
                      {MEETING_STATUS_LABELS[meeting.status as MeetingStatus] ?? meeting.status}
                    </Badge>
                  </div>
                  {meeting.status === 'scheduled' && (
                    <CaptureToggle meetingId={meeting.id} captureOverride={meeting.captureOverride} />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent meetings */}
      {recentMeetings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Meetings
            </h2>
            <Link href="/app/meetings" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentMeetings.map((meeting) => (
              <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
                <div className="flex items-center gap-4 rounded-[10px] border bg-white p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {meeting.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {meeting.startsAt && (
                        <span>{format(meeting.startsAt, 'MMM d')}</span>
                      )}
                      {meeting.durationMs && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.durationMs)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant={meetingStatusVariant(meeting.status)} className="text-[10px]">
                      {MEETING_STATUS_LABELS[meeting.status as MeetingStatus] ?? meeting.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
