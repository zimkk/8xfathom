import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt, encrypt } from '@/lib/crypto/encryption'
import { syncUpcomingMeetings } from '@/lib/services/calendar-sync-service'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, session.user.id),
        eq(calendarConnections.status, 'connected')
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json({ error: 'No active calendar connection' }, { status: 422 })
  }

  let accessToken: string
  try {
    accessToken = await decrypt(connection.encryptedAccessToken)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt token' }, { status: 500 })
  }

  // Refresh token if needed
  if (connection.accessTokenExpiresAt && new Date() >= connection.accessTokenExpiresAt) {
    if (!connection.encryptedRefreshToken) {
      await db
        .update(calendarConnections)
        .set({ status: 'needs_reauth', updatedAt: new Date() })
        .where(eq(calendarConnections.id, connection.id))
      return NextResponse.json({ error: 'Re-authorization required' }, { status: 401 })
    }
    try {
      const { GoogleCalendarClient } = await import('@fathom/integrations/google')
      const client = new GoogleCalendarClient()
      const refreshToken = await decrypt(connection.encryptedRefreshToken)
      const refreshed = await client.refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      await db
        .update(calendarConnections)
        .set({
          encryptedAccessToken: await encrypt(refreshed.accessToken),
          accessTokenExpiresAt: refreshed.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, connection.id))
    } catch (err) {
      console.error('Token refresh failed:', err)
      await db
        .update(calendarConnections)
        .set({ status: 'needs_reauth', updatedAt: new Date() })
        .where(eq(calendarConnections.id, connection.id))
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
    }
  }

  try {
    const { created, total } = await syncUpcomingMeetings(session.user.id, accessToken)

    await db
      .update(calendarConnections)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id))

    return NextResponse.json({ ok: true, created, total })
  } catch (err) {
    console.error('Calendar sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
