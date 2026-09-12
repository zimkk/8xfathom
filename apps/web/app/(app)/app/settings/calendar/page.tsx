import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import Link from 'next/link'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { SyncButton } from '@/components/calendar/sync-button'

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string; synced?: string; disconnected?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const db = getDb()
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, session.user.id),
        eq(calendarConnections.provider, 'google')
      )
    )
    .limit(1)

  const isConnected = connection?.status === 'connected'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Calendar</h1>
      <p className="text-sm text-muted-foreground mb-8">Connect your Google Calendar to automatically capture meetings.</p>

      {params.connected && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Calendar connected successfully!
        </div>
      )}

      {params.disconnected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 border rounded-lg px-4 py-3 mb-6">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Calendar disconnected.
        </div>
      )}

      {params.error && (
        <div className="flex flex-col gap-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {params.error === 'access_denied'
              ? 'Calendar access was denied.'
              : params.error === 'sync_failed'
                ? 'Calendar sync failed. Please try again.'
                : 'Failed to connect calendar.'}
          </div>
          {params.detail && (
            <p className="text-xs text-red-600/80 font-mono pl-6">{params.detail}</p>
          )}
        </div>
      )}

      <div className="border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="8" width="40" height="36" rx="4" fill="#1E88E5"/>
                <rect x="4" y="8" width="40" height="12" rx="4" fill="#1565C0"/>
                <rect x="4" y="14" width="40" height="6" fill="#1565C0"/>
                <circle cx="16" cy="8" r="3" fill="#fff"/>
                <circle cx="32" cy="8" r="3" fill="#fff"/>
                <rect x="10" y="26" width="8" height="6" rx="1" fill="#fff" opacity=".8"/>
                <rect x="20" y="26" width="8" height="6" rx="1" fill="#fff" opacity=".8"/>
                <rect x="30" y="26" width="8" height="6" rx="1" fill="#fff" opacity=".8"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              {isConnected && connection.providerAccountEmail ? (
                <p className="text-xs text-muted-foreground">{connection.providerAccountEmail}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Not connected</p>
              )}
            </div>
          </div>
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
              <form action="/api/calendar/disconnect" method="POST">
                <button
                  type="submit"
                  className="text-xs text-muted-foreground hover:text-destructive border px-2 py-1 rounded-md"
                >
                  Disconnect
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/api/calendar/connect"
              className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Connect
            </Link>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {connection.lastSyncedAt
                ? `Last synced ${connection.lastSyncedAt.toLocaleString()}`
                : 'Not synced yet'}
            </p>
            <SyncButton size="sm" variant="outline" label="Sync now" />
          </div>
        )}
      </div>
    </div>
  )
}
