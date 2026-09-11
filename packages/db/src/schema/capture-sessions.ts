import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const captureSessionStatusEnum = pgEnum('capture_session_status', [
  'created',
  'scheduled',
  'joining',
  'waiting',
  'recording',
  'done',
  'denied',
  'failed',
  'cancelled',
])

export const captureProviderEnum = pgEnum('capture_provider', ['recall'])

export const captureSessions = pgTable('capture_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  provider: captureProviderEnum('provider').notNull().default('recall'),
  providerBotId: text('provider_bot_id').unique(),
  providerRecordingId: text('provider_recording_id'),
  status: captureSessionStatusEnum('status').notNull().default('created'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
  recordingStartedAt: timestamp('recording_started_at', { withTimezone: true }),
  recordingEndedAt: timestamp('recording_ended_at', { withTimezone: true }),
  leftAt: timestamp('left_at', { withTimezone: true }),
  consentMessageSentAt: timestamp('consent_message_sent_at', { withTimezone: true }),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  providerMetadata: jsonb('provider_metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const botEvents = pgTable('bot_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  captureSessionId: uuid('capture_session_id')
    .notNull()
    .references(() => captureSessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  payload: jsonb('payload').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
