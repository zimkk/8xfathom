import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateToken } from '@/lib/crypto/encryption'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = generateToken(16)
  const { GoogleCalendarClient } = await import('@fathom/integrations/google')
  const client = new GoogleCalendarClient()
  const authUrl = client.getAuthUrl(state)

  const response = NextResponse.redirect(authUrl)
  // Store state for CSRF verification in the callback
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
    secure: process.env['NODE_ENV'] === 'production',
  })
  return response
}
