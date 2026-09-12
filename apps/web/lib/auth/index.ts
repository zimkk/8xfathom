import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { waitUntil } from '@vercel/functions'
import { authConfig } from './config'

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
        // Fires on every Google sign-in. Login now requests identity scopes only
        // (calendar consent lives in the dedicated /api/calendar/connect flow so it
        // owns the refresh token), so this only creates a calendar connection on the
        // rare occasion a login token still carries calendar.readonly — otherwise it
        // no-ops and the connect flow handles calendar access.
        async signIn({ user, account }) {
          if (account?.provider !== 'google' || !account.access_token || !user.id) return

          const db = getDb()
          const scopes = account.scope?.split(' ') ?? []
          if (!scopes.includes('https://www.googleapis.com/auth/calendar.readonly')) return

          try {
            const encryptedAccessToken = await encrypt(account.access_token)
            const encryptedRefreshToken = account.refresh_token ? await encrypt(account.refresh_token) : null
            const accessTokenExpiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null

            const [connection] = await db
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
              .returning()

            // The connection row is saved above (fast, needed before the OAuth
            // callback can redirect). The actual calendar sync hits the live
            // Google Calendar API and can take long enough to blow past
            // Vercel's function timeout if awaited here, which would kill the
            // whole callback mid-flight and bounce the user back to /login
            // right after they granted access. Let it run in the background.
            if (connection) {
              const accessToken = account.access_token
              waitUntil(
                (async () => {
                  try {
                    await syncUpcomingMeetings(user.id!, accessToken, connection.id)
                    await db
                      .update(calendarConnections)
                      .set({ lastSyncedAt: new Date() })
                      .where(eq(calendarConnections.userId, user.id!))
                  } catch (err) {
                    console.error('Background calendar sync failed:', err)
                  }
                })()
              )
            }
          } catch (err) {
            console.error('Failed to save calendar connection on sign-in:', err)
          }
        },
      },
    }) as unknown as typeof _na
  }
  return _na!
}

export const auth: AnyFn = (...args: any[]) => getNextAuth().auth(...args)
export const handlers = {
  GET: (...args: any[]) => getNextAuth().handlers.GET(...args),
  POST: (...args: any[]) => getNextAuth().handlers.POST(...args),
}
export const signIn: AnyFn = (...args: any[]) => getNextAuth().signIn(...args)
export const signOut: AnyFn = (...args: any[]) => getNextAuth().signOut(...args)

export type { Session } from 'next-auth'
