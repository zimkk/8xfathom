import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import type { NextMiddleware } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (NextAuth(authConfig) as any).auth as NextMiddleware

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
