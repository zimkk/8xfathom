import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { authConfig } from './config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

let _na: { auth: AnyFn; handlers: { GET: AnyFn; POST: AnyFn }; signIn: AnyFn; signOut: AnyFn } | undefined

function getNextAuth() {
  if (!_na) {
    const { getDb } = require('@fathom/db') as typeof import('@fathom/db')
    const { accounts, sessions, users, verificationTokens, calendarConnections } =
      require('@fathom/db/schema') as typeof import('@fathom/db/schema')
    const { encrypt } = require('@/lib/crypto/encryption') as typeof import('@/lib/crypto/encryption')
    const { syncUpcomingMeetings } = require('@/lib/services/calendar-sync-service') as typeof import('@/lib/services/calendar-sync-service')
    const { eq } = require('drizzle-orm') as typeof import('drizzle-orm')

    _na = NextAuth({
      ...authConfig,
      adapter: DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      }),
      session: { strategy: 'database' },
      events: {
        // Fires on every Google sign-in (not just the first). Since we request
        // calendar.readonly scope on the main login, this is where we turn the
        // OAuth tokens Google just issued into an active calendar connection —
        // no separate "connect calendar" step needed.
        async signIn({ user, account }) {
          if (account?.provider !== 'google' || !account.access_token || !user.id) return

          const db = getDb()
          const scopes = account.scope?.split(' ') ?? []
          if (!scopes.includes('https://www.googleapis.com/auth/calendar.readonly')) return

          try {
            const encryptedAccessToken = await encrypt(account.access_token)
            const encryptedRefreshToken = account.refresh_token ? await encrypt(account.refresh_token) : null
            const accessTokenExpiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null

            await db
              .insert(calendarConnections)
              .values({
                userId: user.id,
                provider: 'google',
                providerAccountEmail: user.email ?? '',
                status: 'connected',
                encryptedAccessToken,
                encryptedRefreshToken,
                accessTokenExpiresAt,
                scopes,
              })
              .onConflictDoUpdate({
                target: calendarConnections.userId,
                set: {
                  providerAccountEmail: user.email ?? '',
                  status: 'connected',
                  encryptedAccessToken,
                  // Google only returns a refresh_token on the first consent — keep the
                  // existing one on subsequent logins rather than overwriting with null.
                  ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
                  accessTokenExpiresAt,
                  scopes,
                  updatedAt: new Date(),
                },
              })

            await syncUpcomingMeetings(user.id, account.access_token)
            await db
              .update(calendarConnections)
              .set({ lastSyncedAt: new Date() })
              .where(eq(calendarConnections.userId, user.id))
          } catch (err) {
            console.error('Failed to sync calendar connection on sign-in:', err)
          }
        },
      },
    }) as unknown as typeof _na
  }
  return _na!
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: AnyFn = (...args: any[]) => getNextAuth().auth(...args)
export const handlers = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GET: (...args: any[]) => getNextAuth().handlers.GET(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  POST: (...args: any[]) => getNextAuth().handlers.POST(...args),
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: AnyFn = (...args: any[]) => getNextAuth().signIn(...args)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut: AnyFn = (...args: any[]) => getNextAuth().signOut(...args)

export type { Session } from 'next-auth'
