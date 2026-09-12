import { NextResponse } from 'next/server'
import { getDb } from '@fathom/db'
import { meetings, userCapturePreferences, captureSessions, calendarConnections } from '@fathom/db/schema'
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'

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

  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true' || !process.env['RECALL_API_KEY']) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'mock mode or no Recall key' })
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
    // Check user capture preferences
    const [prefs] = await db
      .select()
      .from(userCapturePreferences)
      .where(eq(userCapturePreferences.userId, userId))
      .limit(1)

    if (!prefs || prefs.defaultMode === 'none') {
      totalSkipped++
      continue
    }

    // Find upcoming meetings without a capture session
    const upcomingMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, userId),
          eq(meetings.status, 'scheduled'),
          eq(meetings.captureEnabled, true),
          gte(meetings.startsAt, now),
          lte(meetings.startsAt, lookahead),
        ),
      )

    for (const meeting of upcomingMeetings) {
      if (!meeting.meetingUrl) continue

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
          botDisplayName: 'Fathom Notetaker',
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
