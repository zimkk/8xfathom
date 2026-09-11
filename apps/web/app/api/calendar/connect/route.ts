import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateToken } from '@/lib/crypto/encryption'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true') {
    const db = getDb()
    const existing = await db
      .select({ id: calendarConnections.id })
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, session.user.id))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(calendarConnections)
        .set({ status: 'connected', updatedAt: new Date() })
        .where(eq(calendarConnections.userId, session.user.id))
    } else {
      await db
        .insert(calendarConnections)
        .values({
          userId: session.user.id,
          provider: 'google',
          providerAccountEmail: 'mock@example.com',
          status: 'connected',
          encryptedAccessToken: 'mock-token',
          encryptedRefreshToken: 'mock-refresh',
          accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        })
    }

    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
    return NextResponse.redirect(`${appUrl}/app/settings/calendar?connected=true`)
  }

  const state = generateToken(16)
  const { GoogleCalendarClient } = await import('@fathom/integrations/google')
  const client = new GoogleCalendarClient()
  const authUrl = client.getAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
