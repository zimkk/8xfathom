import { getDb } from '@fathom/db'
import { meetings } from '@fathom/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'
import { validateGoogleMeetUrl } from '@fathom/core'

export async function syncUpcomingMeetings(userId: string, accessToken: string): Promise<{ created: number; total: number }> {
  const db = getDb()
  const { GoogleCalendarClient } = await import('@fathom/integrations/google')
  const client = new GoogleCalendarClient()

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
          eq(meetings.userId, userId),
          eq(meetings.meetingUrl, meetingUrl),
          gte(meetings.startsAt, dayStart),
          lt(meetings.startsAt, dayEnd),
        )
      )
      .limit(1)

    if (exists) continue

    await db.insert(meetings).values({
      userId,
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

  return { created, total: events.length }
}
