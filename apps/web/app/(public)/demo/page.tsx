import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDemoMeetings } from '@/lib/services/meeting-service'
import { MeetingCard } from '@/components/meeting/meeting-card'
import { formatDuration } from '@/lib/utils'
import { format } from 'date-fns'

export const metadata = { title: 'Demo — Fathom 8x' }

export default async function DemoPage() {
  const demoMeetings = await getDemoMeetings(20).catch(() => [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="font-semibold text-sm">Fathom 8x</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button size="sm">Sign in to connect your calendar</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Demo banner */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="max-w-6xl mx-auto px-6 py-2.5 text-center text-sm text-primary/80">
          Demo workspace —{' '}
          <Link href="/login" className="font-medium text-primary underline">
            sign in
          </Link>{' '}
          to connect your calendar and record your own meetings.
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Meeting Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {demoMeetings.length} demo meetings — explore AI notes, transcripts, and highlights.
          </p>
        </div>

        {demoMeetings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No demo meetings yet. Run the seed script to populate demo data.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {demoMeetings.map((meeting) => (
              <Link key={meeting.id} href={`/demo/meetings/${meeting.id}`}>
                <div className="group rounded-[12px] border bg-white p-5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                        Notes ready
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
