import { task } from '@trigger.dev/sdk/v3'
import { z } from 'zod'
import { getDb } from '@fathom/db'
import { calendarConnections, meetings } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateGoogleMeetUrl } from '@fathom/core/domain/types'

const InputSchema = z.object({
  userId: z.string(),
})

export const calendarSyncTask = task({
  id: 'calendar.sync',
  maxDuration: 60,
  async run(payload: z.infer<typeof InputSchema>) {
    const input = InputSchema.parse(payload)
    const db = getDb()

    const [connection] = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.userId, input.userId),
          eq(calendarConnections.provider, 'google'),
          eq(calendarConnections.status, 'active')
        )
      )
      .limit(1)

    if (!connection) return { userId: input.userId, synced: 0, error: 'no_connection' }

    // Decrypt access token
    const { decrypt } = await import('@fathom/core/crypto')
    let accessToken: string
    try {
      accessToken = decrypt(connection.encryptedAccessToken)
    } catch {
      return { userId: input.userId, synced: 0, error: 'decrypt_failed' }
    }

    // Refresh if expired
    if (connection.accessTokenExpiresAt && new Date() >= connection.accessTokenExpiresAt) {
      const { GoogleCalendarClient } = await import('@fathom/integrations/google')
      const client = new GoogleCalendarClient()
      const refreshToken = decrypt(connection.encryptedRefreshToken ?? '')
      const refreshed = await client.refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      const { encrypt } = await import('@fathom/core/crypto')
      await db
        .update(calendarConnections)
        .set({
          encryptedAccessToken: encrypt(refreshed.accessToken),
          accessTokenExpiresAt: refreshed.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, connection.id))
    }

    const { GoogleCalendarClient } = await import('@fathom/integrations/google')
    const client = new GoogleCalendarClient()
    const events = await client.listUpcomingEvents(accessToken)

    let synced = 0
    for (const event of events) {
      const meetingUrl = event.hangoutLink ??
        event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri

      if (!meetingUrl || !validateGoogleMeetUrl(meetingUrl)) continue

      const startsAt = event.start.dateTime ? new Date(event.start.dateTime) : null
      const endsAt = event.end.dateTime ? new Date(event.end.dateTime) : null
      if (!startsAt) continue

      await db
        .insert(meetings)
        .values({
          userId: input.userId,
          title: event.summary ?? 'Untitled Meeting',
          meetingUrl,
          source: 'calendar',
          status: 'scheduled',
          visibility: 'private',
          startsAt,
          endsAt,
        })
        .onConflictDoNothing()

      synced++
    }

    return { userId: input.userId, synced }
  },
})
