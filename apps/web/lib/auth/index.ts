import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { authConfig } from './config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

let _na: { auth: AnyFn; handlers: { GET: AnyFn; POST: AnyFn }; signIn: AnyFn; signOut: AnyFn } | undefined

function getNextAuth() {
  if (!_na) {
    const { getDb } = require('@fathom/db') as typeof import('@fathom/db')
    const { accounts, sessions, users, verificationTokens } = require('@fathom/db/schema') as typeof import('@fathom/db/schema')
    _na = NextAuth({
      ...authConfig,
      adapter: DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      }),
      session: { strategy: 'database' },
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
