import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'

const isDev = process.env['NODE_ENV'] === 'development'
const devBypass = process.env['DEV_AUTH_BYPASS'] === 'true'

const providers: NextAuthConfig['providers'] = []

// Google OAuth — only if credentials are configured
if (process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']) {
  providers.push(
    Google({
      clientId: process.env['GOOGLE_CLIENT_ID'],
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
    })
  )
}

// Dev bypass — sign in as a seeded demo user without any OAuth
// Only active in development when DEV_AUTH_BYPASS=true
if (isDev && devBypass) {
  providers.push(
    Credentials({
      id: 'dev-bypass',
      name: 'Dev Sign-In',
      credentials: {
        name: { label: 'Name', type: 'text', placeholder: 'Demo User' },
        email: { label: 'Email', type: 'email', placeholder: 'demo@fathom8x.dev' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        // Return a synthetic user — Auth.js will upsert via adapter
        return {
          id: `dev-${Buffer.from(String(credentials.email)).toString('base64').slice(0, 16)}`,
          name: String(credentials.name || 'Demo User'),
          email: String(credentials.email),
          image: null,
        }
      },
    })
  )
}

export const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAppRoute = nextUrl.pathname.startsWith('/app')
      if (isAppRoute && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl))
      }
      return true
    },
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id
      }
      return session
    },
  },
}
