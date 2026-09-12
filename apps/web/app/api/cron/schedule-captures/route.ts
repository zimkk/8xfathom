import { NextResponse } from 'next/server'
import { getDb } from '@fathom/db'
import { meetings, userCapturePreferences, captureSessions, calendarConnections, calendarEvents, users } from '@fathom/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'
import { evaluateCaptureDecision, classifyMeeting } from '@fathom/core'

// Default 60s (Hobby). Each bot schedule call is ~200ms so this handles ~200 meetings per run.

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  const secret = process.env['CRON_SECRET']
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env['RECALL_API_KEY']) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no Recall key' })
  }

  const db = getDb()
  const now = new Date()
  const lookahead = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Get all users who have an active calendar connection (they opted in to auto-capture)
  const activeUsers = await db
    .selectDistinct({ userId: calendarConnections.userId })
    .from(calendarConnections)
    .where(isNotNull(calendarConnections.encryptedAccessToken))

  const { RecallCaptureProvider } = await import('@fathom/integrations')
  const recall = new RecallCaptureProvider()

  let totalScheduled = 0
  let totalSkipped = 0

  for (const { userId } of activeUsers) {
    const [prefs] = await db
      .select()
      .from(userCapturePreferences)
      .where(eq(userCapturePreferences.userId, userId))
      .limit(1)

    const defaultMode = prefs?.defaultMode ?? 'all'
    if (defaultMode === 'none') {
      totalSkipped++
      continue
    }

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) continue

    // Find upcoming meetings without a capture session, with attendee data for classification
    const upcomingMeetings = await db
      .select({
        meeting: meetings,
        attendeeEmails: calendarEvents.attendeeEmails,
      })
      .from(meetings)
      .leftJoin(calendarEvents, eq(meetings.calendarEventId, calendarEvents.id))
      .where(
        and(
          eq(meetings.userId, userId),
          eq(meetings.status, 'scheduled'),
          gte(meetings.startsAt, now),
          lte(meetings.startsAt, lookahead),
        ),
      )

    for (const { meeting, attendeeEmails } of upcomingMeetings) {
      if (!meeting.meetingUrl) continue

      const classification = classifyMeeting(attendeeEmails ?? [], user.email)
      const decision = evaluateCaptureDecision({
        defaultMode,
        classification,
        override: meeting.captureOverride,
        meetingUrl: meeting.meetingUrl,
        isCancelled: meeting.status === 'cancelled',
      })

      if (!decision.shouldCapture) {
        totalSkipped++
        continue
      }

      // Skip if already has a capture session
      const [existingSession] = await db
        .select({ id: captureSessions.id })
        .from(captureSessions)
        .where(eq(captureSessions.meetingId, meeting.id))
        .limit(1)

      if (existingSession) continue

      try {
        const session = await recall.schedule({
          meetingId: meeting.id,
          meetingUrl: meeting.meetingUrl,
          title: meeting.title,
          startAt: meeting.startsAt ?? new Date(),
          botDisplayName: prefs?.botDisplayName ?? 'Fathom Notetaker',
          metadata: {},
          consent: { enabled: false, message: '' },
        })

        await db.insert(captureSessions).values({
          meetingId: meeting.id,
          provider: 'recall',
          providerBotId: session.providerSessionId,
          status: 'scheduled',
        })

        totalScheduled++
      } catch (err) {
        console.error('[cron/schedule-captures] Failed for meeting', meeting.id, err)
      }
    }
  }

  return NextResponse.json({ ok: true, scheduled: totalScheduled, skipped: totalSkipped })
}
