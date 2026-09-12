import { getDb } from '@fathom/db'
import { meetings, calendarEvents } from '@fathom/db/schema'
import { eq, and, isNotNull, ne, gte, lte } from 'drizzle-orm'
import { validateGoogleMeetUrl } from '@fathom/core'

const PROVIDER_CALENDAR_ID = 'primary'
const ACTIVE_MEETING_STATUSES = ['scheduled', 'bot_queued'] as const
const SYNC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export async function syncUpcomingMeetings(
  userId: string,
  accessToken: string,
  calendarConnectionId: string
): Promise<{ created: number; updated: number; cancelled: number; total: number }> {
  const db = getDb()
  const { GoogleCalendarClient } = await import('@fathom/integrations/google')
  const client = new GoogleCalendarClient()

  // Bound the sync window and page through all events in it, so cancellation below can safely
  // treat "in-window but not seen" as removed without mistaking pagination overflow for deletion.
  const windowStart = new Date()
  const windowEnd = new Date(windowStart.getTime() + SYNC_WINDOW_MS)
  const events = await client.listUpcomingEvents(accessToken, { timeMax: windowEnd.toISOString() })
  let created = 0
  let updated = 0
  const createdMeetingIds: string[] = []
  const seenProviderEventIds = new Set<string>()

  for (const event of events) {
    if (event.status === 'cancelled') continue

    const meetingUrl = event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri?: string }) => ep.entryPointType === 'video')?.uri

    if (!meetingUrl || !validateGoogleMeetUrl(meetingUrl)) continue

    const startsAt = event.start.dateTime ? new Date(event.start.dateTime) : null
    const endsAt = event.end.dateTime ? new Date(event.end.dateTime) : null
    if (!startsAt || !endsAt) continue

    seenProviderEventIds.add(event.id)

    const attendeeEmails = (event.attendees ?? []).map((a) => a.email).filter(Boolean)

    // Upsert the calendar_events record for this Google event
    const [calendarEvent] = await db
      .insert(calendarEvents)
      .values({
        userId,
        calendarConnectionId,
        providerEventId: event.id,
        providerCalendarId: PROVIDER_CALENDAR_ID,
        title: event.summary ?? 'Untitled Meeting',
        startsAt,
        endsAt,
        meetingUrl,
        meetingPlatform: 'google_meet',
        organizerEmail: event.organizer?.email ?? null,
        attendeeEmails,
        attendeeCount: attendeeEmails.length,
        status: 'confirmed',
      })
      .onConflictDoUpdate({
        target: [calendarEvents.userId, calendarEvents.providerCalendarId, calendarEvents.providerEventId],
        set: {
          title: event.summary ?? 'Untitled Meeting',
          startsAt,
          endsAt,
          meetingUrl,
          organizerEmail: event.organizer?.email ?? null,
          attendeeEmails,
          attendeeCount: attendeeEmails.length,
          status: 'confirmed',
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!calendarEvent) continue

    const [existingMeeting] = await db
      .select({ id: meetings.id, status: meetings.status, startsAt: meetings.startsAt, endsAt: meetings.endsAt })
      .from(meetings)
      .where(eq(meetings.calendarEventId, calendarEvent.id))
      .limit(1)

    if (!existingMeeting) {
      const [createdMeeting] = await db.insert(meetings).values({
        userId,
        calendarEventId: calendarEvent.id,
        title: event.summary ?? 'Untitled Meeting',
        meetingUrl,
        source: 'calendar',
        status: 'scheduled',
        visibility: 'private',
        startsAt,
        endsAt,
      }).returning({ id: meetings.id })
      created++
      if (createdMeeting) createdMeetingIds.push(createdMeeting.id)
      continue
    }

    // Reschedule: only touch meetings that haven't started yet
    const timeChanged =
      existingMeeting.startsAt?.getTime() !== startsAt.getTime() ||
      existingMeeting.endsAt?.getTime() !== endsAt.getTime()

    if (timeChanged && ACTIVE_MEETING_STATUSES.includes(existingMeeting.status as typeof ACTIVE_MEETING_STATUSES[number])) {
      await db
        .update(meetings)
        .set({ startsAt, endsAt, updatedAt: new Date() })
        .where(eq(meetings.id, existingMeeting.id))
      updated++
    }
  }

  // Cancellation: any previously-synced event for this connection that wasn't
  // seen in this fetch (removed or now cancelled on Google's side)
  // Only within the window we actually fetched — an event outside it wasn't looked at and must
  // never be inferred as cancelled.
  const staleEvents = await db
    .select({ id: calendarEvents.id, providerEventId: calendarEvents.providerEventId })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarConnectionId, calendarConnectionId),
        ne(calendarEvents.status, 'cancelled'),
        gte(calendarEvents.startsAt, windowStart),
        lte(calendarEvents.startsAt, windowEnd)
      )
    )

  let cancelled = 0
  for (const stale of staleEvents) {
    if (seenProviderEventIds.has(stale.providerEventId)) continue

    await db.update(calendarEvents).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(calendarEvents.id, stale.id))

    const [linkedMeeting] = await db
      .select({ id: meetings.id, status: meetings.status })
      .from(meetings)
      .where(and(eq(meetings.calendarEventId, stale.id), isNotNull(meetings.calendarEventId)))
      .limit(1)

    if (linkedMeeting && ACTIVE_MEETING_STATUSES.includes(linkedMeeting.status as typeof ACTIVE_MEETING_STATUSES[number])) {
      await db.update(meetings).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(meetings.id, linkedMeeting.id))
      cancelled++
    }
  }

  // Schedule capture bots immediately for newly-created meetings instead of waiting for the daily
  // cron (which, on Vercel Hobby, can't run often enough to catch same-day meetings). Recall
  // accepts a future join_at, so scheduling early is fine. scheduleCapture re-evaluates the
  // capture decision and dedups, so this is safe and idempotent. Best-effort: a provider failure
  // must not fail the whole sync — the daily cron remains a backstop.
  if (process.env['RECALL_API_KEY'] && createdMeetingIds.length > 0) {
    const { captureOrchestration } = await import('./capture-orchestration-service')
    for (const id of createdMeetingIds) {
      try {
        await captureOrchestration.scheduleCapture(id)
      } catch (err) {
        console.error('[calendar-sync] Failed to schedule capture for meeting', id, err)
      }
    }
  }

  return { created, updated, cancelled, total: events.length }
}
