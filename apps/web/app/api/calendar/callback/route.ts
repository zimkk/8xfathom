import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { encrypt } from '@/lib/crypto/encryption'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const session = await auth()
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'

  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/app/settings/calendar?error=access_denied`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('oauth_state')?.value
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/app/settings/calendar?error=invalid_state`)
  }

  try {
    const { GoogleCalendarClient } = await import('@fathom/integrations/google')
    const client = new GoogleCalendarClient()
    const tokens = await client.exchangeCode(code)

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const profile = await profileRes.json() as { email: string }

    const db = getDb()
    const [encryptedAccess, encryptedRefresh] = await Promise.all([
      encrypt(tokens.accessToken),
      encrypt(tokens.refreshToken),
    ])

    // Upsert calendar connection
    const existing = await db
      .select({ id: calendarConnections.id })
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, session.user.id))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(calendarConnections)
        .set({
          status: 'connected',
          providerAccountEmail: profile.email,
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          accessTokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scope.split(' '),
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.userId, session.user.id))
    } else {
      await db
        .insert(calendarConnections)
        .values({
          userId: session.user.id,
          provider: 'google',
          providerAccountEmail: profile.email,
          status: 'connected',
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          accessTokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scope.split(' '),
        })
    }

    const successResponse = NextResponse.redirect(`${appUrl}/app/settings/calendar?connected=true`)
    successResponse.cookies.delete('oauth_state')
    return successResponse
  } catch (err) {
    console.error('Calendar callback error:', err)
    return NextResponse.redirect(`${appUrl}/app/settings/calendar?error=token_exchange_failed`)
  }
}
