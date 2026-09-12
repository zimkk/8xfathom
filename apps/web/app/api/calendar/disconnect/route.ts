import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  await db
    .update(calendarConnections)
    .set({ status: 'disconnected', updatedAt: new Date() })
    .where(
      and(
        eq(calendarConnections.userId, session.user.id),
        eq(calendarConnections.provider, 'google')
      )
    )

  // This is submitted from a <form>, so redirect back to the settings page (303 → GET) rather
  // than leaving the user staring at raw JSON.
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  return NextResponse.redirect(`${appUrl}/app/settings/calendar?disconnected=1`, 303)
}
