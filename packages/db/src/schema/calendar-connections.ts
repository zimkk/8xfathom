import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const calendarProviderEnum = pgEnum('calendar_provider', ['google'])

export const calendarConnectionStatusEnum = pgEnum('calendar_connection_status', [
  'connected',
  'needs_reauth',
  'disconnected',
  'error',
])

export const calendarConnections = pgTable('calendar_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  provider: calendarProviderEnum('provider').notNull().default('google'),
  providerAccountEmail: text('provider_account_email').notNull(),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  scopes: text('scopes').array().notNull().default([]),
  syncToken: text('sync_token'),
  status: calendarConnectionStatusEnum('status').notNull().default('connected'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
