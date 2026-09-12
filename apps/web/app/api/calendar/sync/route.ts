import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { calendarConnections, meetings } from '@fathom/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'
import { decrypt, encrypt } from '@/lib/crypto/encryption'
import { validateGoogleMeetUrl } from '@fathom/core'

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

  const { GoogleCalendarClient, MockGoogleCalendarClient } = await import('@fathom/integrations/google')
  const client = process.env['USE_MOCK_INTEGRATIONS'] === 'true'
    ? new MockGoogleCalendarClient()
    : new GoogleCalendarClient()

  try {
    const events = await client.listUpcomingEvents(accessToken)
    let created = 0

    for (const event of events) {
      const meetingUrl = event.hangoutLink ??
        event.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri?: string }) => ep.entryPointType === 'video')?.uri

      if (!meetingUrl || !validateGoogleMeetUrl(meetingUrl)) continue

      const startsAt = event.start.dateTime ? new Date(event.start.dateTime) : null
      const endsAt = event.end.dateTime ? new Date(event.end.dateTime) : null
      if (!startsAt) continue

      // Dedup: skip if a meeting with same user + URL already exists on this day
      const dayStart = new Date(startsAt)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [exists] = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(
          and(
            eq(meetings.userId, session.user.id),
            eq(meetings.meetingUrl, meetingUrl),
            gte(meetings.startsAt, dayStart),
            lt(meetings.startsAt, dayEnd),
          )
        )
        .limit(1)

      if (exists) continue

      await db.insert(meetings).values({
        userId: session.user.id,
        title: event.summary ?? 'Untitled Meeting',
        meetingUrl,
        source: 'calendar',
        status: 'scheduled',
        visibility: 'private',
        startsAt,
        endsAt,
      })

      created++
    }

    await db
      .update(calendarConnections)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id))

    return NextResponse.json({ ok: true, created, total: events.length })
  } catch (err) {
    console.error('Calendar sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
