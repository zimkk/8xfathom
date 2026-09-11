import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { calendarConnections } from './calendar-connections.js'

export const calendarEventStatusEnum = pgEnum('calendar_event_status', [
  'confirmed',
  'tentative',
  'cancelled',
])

export const meetingPlatformEnum = pgEnum('meeting_platform', ['google_meet', 'unknown'])

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarConnectionId: uuid('calendar_connection_id')
      .notNull()
      .references(() => calendarConnections.id, { onDelete: 'cascade' }),
    providerEventId: text('provider_event_id').notNull(),
    providerCalendarId: text('provider_calendar_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timezone: text('timezone'),
    meetingUrl: text('meeting_url'),
    meetingPlatform: meetingPlatformEnum('meeting_platform').notNull().default('unknown'),
    organizerEmail: text('organizer_email'),
    attendeeEmails: text('attendee_emails').array().notNull().default([]),
    attendeeCount: integer('attendee_count').notNull().default(0),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurringEventId: text('recurring_event_id'),
    providerUpdatedAt: timestamp('provider_updated_at', { withTimezone: true }),
    status: calendarEventStatusEnum('status').notNull().default('confirmed'),
    rawHash: text('raw_hash'),
    rawMetadata: jsonb('raw_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueUserCalendarEvent: unique().on(t.userId, t.providerCalendarId, t.providerEventId),
  })
)
