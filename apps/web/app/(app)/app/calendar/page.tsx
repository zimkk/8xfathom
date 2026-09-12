import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDb } from '@fathom/db'
import { meetings, calendarConnections } from '@fathom/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import Link from 'next/link'
import { Calendar, Plus, Clock, AlertTriangle } from 'lucide-react'
import { MEETING_STATUS_LABELS } from '@fathom/core'
import type { MeetingStatus } from '@fathom/core'
import { CaptureToggle } from '@/components/meeting/capture-toggle'
import { Badge } from '@/components/ui/badge'
import { meetingStatusVariant } from '@/lib/utils'

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const db = getDb()
  const now = new Date()
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const [upcomingMeetings, connection] = await Promise.all([
    db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, session.user.id),
          gte(meetings.startsAt, now),
          lte(meetings.startsAt, twoWeeksOut)
        )
      )
      .orderBy(meetings.startsAt)
      .limit(50),
    db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, session.user.id))
      .limit(1),
  ])

  const isConnected = connection[0]?.status === 'connected'
  const needsReauth = connection[0]?.status === 'needs_reauth' || connection[0]?.status === 'error'

  // Group by date
  const grouped: Record<string, typeof upcomingMeetings> = {}
  for (const m of upcomingMeetings) {
    if (!m.startsAt) continue
    const key = m.startsAt.toDateString()
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Link
          href="/app/meetings/new"
          className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Notetaker
        </Link>
      </div>

      {needsReauth && (
        <div className="border border-amber-200 rounded-xl p-5 mb-6 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Reconnect Google Calendar</p>
              <p className="text-sm text-amber-800 mt-0.5">
                We can no longer see your upcoming meetings. Your past meetings are still available.
              </p>
              <Link
                href="/api/calendar/connect"
                className="inline-block mt-3 text-sm font-medium text-amber-900 hover:underline"
              >
                Reconnect →
              </Link>
            </div>
          </div>
        </div>
      )}

      {!isConnected && !needsReauth && (
        <div className="border rounded-xl p-5 mb-6 bg-muted/30">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Connect your calendar</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect Google Calendar to automatically capture upcoming meetings.
              </p>
              <Link
                href="/app/settings/calendar"
                className="inline-block mt-3 text-sm font-medium text-primary hover:underline"
              >
                Connect Calendar →
              </Link>
            </div>
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No upcoming meetings</p>
          <p className="text-xs mt-1">
            {isConnected ? 'Meetings with Google Meet links will appear here.' : 'Connect your calendar to see meetings.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, dayMeetings]) => (
            <div key={dateStr}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {formatDate(new Date(dateStr))}
              </h2>
              <div className="space-y-2">
                {dayMeetings.map((m) => (
                  <Link key={m.id} href={`/app/meetings/${m.id}`}>
                    <div className="border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all bg-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{m.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {m.startsAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(m.startsAt)}
                                {m.endsAt && ` – ${formatTime(m.endsAt)}`}
                              </span>
                            )}
                          </div>
                        </div>
                        {m.status === 'scheduled' ? (
                          <CaptureToggle meetingId={m.id} captureOverride={m.captureOverride} />
                        ) : (
                          <Badge variant={meetingStatusVariant(m.status)} className="text-[10px] shrink-0">
                            {MEETING_STATUS_LABELS[m.status as MeetingStatus] ?? m.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
