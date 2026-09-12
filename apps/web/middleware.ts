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

// The Chrome extension calls /api/extension/* from a content script running on the meeting page,
// so those requests are cross-origin (Origin: https://meet.google.com) and need CORS headers plus
// a preflight (OPTIONS) response. Additional origins can be allowed via EXTENSION_ALLOWED_ORIGINS
// (comma-separated) — e.g. a chrome-extension://<id> origin if the extension ever calls directly.
const EXTENSION_ALLOWED_ORIGINS = new Set(
  [
    'https://meet.google.com',
    ...(process.env['EXTENSION_ALLOWED_ORIGINS']?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
  ],
)

function applyCors(response: NextResponse, origin: string | null): NextResponse {
  if (origin && EXTENSION_ALLOWED_ORIGINS.has(origin)) {
    // Echo the specific origin (never "*") because these requests carry credentials (the session
    // cookie); the spec forbids "*" with credentials.
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
    response.headers.append('Vary', 'Origin')
  }
  return response
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CORS for the extension API surface
  if (pathname.startsWith('/api/extension')) {
    const origin = request.headers.get('origin')
    if (request.method === 'OPTIONS') {
      // Preflight — answer here so it never falls through to a route that has no OPTIONS handler.
      return applyCors(new NextResponse(null, { status: 204 }), origin)
    }
    return applyCors(NextResponse.next(), origin)
  }

  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))

  if (!hasSessionCookie && pathname.startsWith('/app')) {
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
