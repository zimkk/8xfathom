import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const captureModeEnum = pgEnum('capture_mode', [
  'all',
  'external_only',
  'internal_only',
  'none',
])

export const userCapturePreferences = pgTable('user_capture_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  defaultMode: captureModeEnum('default_mode').notNull().default('all'),
  botDisplayName: text('bot_display_name').notNull().default('AI Notetaker'),
  joinLeadSeconds: integer('join_lead_seconds').notNull().default(60),
  leaveGraceSeconds: integer('leave_grace_seconds').notNull().default(60),
  sendConsentMessage: boolean('send_consent_message').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
