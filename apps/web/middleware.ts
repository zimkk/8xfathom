import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This runs on the Edge runtime and can't use the database-adapter-aware
// `auth()` from lib/auth/index.ts (that needs Node's postgres driver). A
// separate NextAuth(authConfig) instance here would default to JWT session
// verification since it has no adapter — but our sessions use the database
// strategy, stored as an opaque token, not a JWT. Trying to verify that
// token as a JWT always fails, silently rejecting every valid session and
// bouncing users back to /login right after a successful sign-in.
//
// Every protected page and API route already calls the correctly-configured
// auth() itself (see e.g. apps/web/app/(app)/layout.tsx), so this only needs
// to catch the case where there's no session cookie at all — real
// verification happens downstream.
const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token']

export default function middleware(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))

  if (!hasSessionCookie && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/meetings/:path*',
    '/api/calendar/:path*',
    '/api/highlights/:path*',
    '/api/shares/:path*',
    '/api/search',
    '/api/extension/:path*',
  ],
}
