import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  real,
  integer,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { meetings } from './meetings.js'
import { meetingParticipants } from './meeting-participants.js'

export const transcriptSourceEnum = pgEnum('transcript_source', ['recall', 'seed'])

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id').references(() => meetingParticipants.id, {
      onDelete: 'set null',
    }),
    speakerName: text('speaker_name').notNull(),
    startMs: bigint('start_ms', { mode: 'number' }).notNull(),
    endMs: bigint('end_ms', { mode: 'number' }).notNull(),
    text: text('text').notNull(),
    confidence: real('confidence'),
    source: transcriptSourceEnum('source').notNull().default('seed'),
    sequence: integer('sequence').notNull(),
    searchTsv: text('search_tsv'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    meetingSequenceIdx: index('transcript_meeting_sequence_idx').on(t.meetingId, t.sequence),
    meetingStartMsIdx: index('transcript_meeting_start_ms_idx').on(t.meetingId, t.startMs),
    endMsCheck: check('end_ms_gte_start_ms', sql`${t.endMs} >= ${t.startMs}`),
  })
)
