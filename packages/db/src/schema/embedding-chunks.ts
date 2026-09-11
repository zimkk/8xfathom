import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  unique,
} from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const embeddingChunks = pgTable(
  'embedding_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    startMs: bigint('start_ms', { mode: 'number' }).notNull(),
    endMs: bigint('end_ms', { mode: 'number' }).notNull(),
    text: text('text').notNull(),
    segmentIds: uuid('segment_ids').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueMeetingChunkIndex: unique().on(t.meetingId, t.chunkIndex),
  })
)
