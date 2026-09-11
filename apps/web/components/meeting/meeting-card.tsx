import Link from 'next/link'
import { format } from 'date-fns'
import { Clock, Calendar, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MEETING_STATUS_LABELS } from '@fathom/core'
import type { MeetingStatus } from '@fathom/core'
import { formatDuration } from '@/lib/utils'

interface Meeting {
  id: string
  title: string
  status: string
  startsAt?: Date | null
  durationMs?: number | null
  participantCount?: number | null
}

interface MeetingCardProps {
  meeting: Meeting
  href: string
}

function getStatusVariant(status: string) {
  if (status === 'recording') return 'destructive'
  if (status === 'ready') return 'success'
  if (status === 'processing') return 'purple'
  if (['bot_queued', 'bot_starting', 'waiting_for_admission'].includes(status)) return 'warning'
  return 'secondary'
}

export function MeetingCard({ meeting, href }: MeetingCardProps) {
  return (
    <Link href={href}>
      <div className="group rounded-[12px] border bg-white p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
              {meeting.title}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {meeting.startsAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(meeting.startsAt), 'MMM d, yyyy')}
                </span>
              )}
              {meeting.durationMs && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(meeting.durationMs)}
                </span>
              )}
              {meeting.participantCount != null && meeting.participantCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {meeting.participantCount}
                </span>
              )}
            </div>
          </div>
          <Badge variant={getStatusVariant(meeting.status) as any} className="text-[10px] shrink-0">
            {MEETING_STATUS_LABELS[meeting.status as MeetingStatus] ?? meeting.status}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
