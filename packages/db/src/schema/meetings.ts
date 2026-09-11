import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { calendarEvents } from './calendar-events.js'

export const meetingStatusEnum = pgEnum('meeting_status', [
  'scheduled',
  'bot_queued',
  'bot_starting',
  'waiting_for_admission',
  'recording',
  'ended',
  'processing',
  'ready',
  'denied',
  'failed',
  'cancelled',
])

export const meetingSourceEnum = pgEnum('meeting_source', ['calendar', 'manual', 'seed'])

export const meetingVisibilityEnum = pgEnum('meeting_visibility', ['private', 'demo'])

export const transcriptStatusEnum = pgEnum('transcript_status', [
  'pending',
  'partial',
  'complete',
  'failed',
])

export const captureOverrideEnum = pgEnum('capture_override', ['inherit', 'enabled', 'disabled'])

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    calendarEventId: uuid('calendar_event_id').references(() => calendarEvents.id, {
      onDelete: 'set null',
    }),
    source: meetingSourceEnum('source').notNull().default('manual'),
    title: text('title').notNull(),
    meetingUrl: text('meeting_url'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    actualStartedAt: timestamp('actual_started_at', { withTimezone: true }),
    actualEndedAt: timestamp('actual_ended_at', { withTimezone: true }),
    durationMs: bigint('duration_ms', { mode: 'number' }),
    platform: text('platform').notNull().default('google_meet'),
    status: meetingStatusEnum('status').notNull().default('scheduled'),
    captureEnabled: boolean('capture_enabled').notNull().default(true),
    captureOverride: captureOverrideEnum('capture_override').notNull().default('inherit'),
    visibility: meetingVisibilityEnum('visibility').notNull().default('private'),
    summaryTemplateDefault: text('summary_template_default').notNull().default('general'),
    recordingStoragePath: text('recording_storage_path'),
    recordingMimeType: text('recording_mime_type'),
    recordingSizeBytes: bigint('recording_size_bytes', { mode: 'number' }),
    transcriptStatus: transcriptStatusEnum('transcript_status').notNull().default('pending'),
    processingErrorCode: text('processing_error_code'),
    processingErrorMessage: text('processing_error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userStartsAtIdx: index('meetings_user_starts_at_idx').on(t.userId, t.startsAt),
    userStatusIdx: index('meetings_user_status_idx').on(t.userId, t.status),
    statusStartsAtIdx: index('meetings_status_starts_at_idx').on(t.status, t.startsAt),
  })
)
