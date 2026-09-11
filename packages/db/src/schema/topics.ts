import { pgTable, uuid, text, timestamp, bigint, integer } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary'),
  startMs: bigint('start_ms', { mode: 'number' }),
  endMs: bigint('end_ms', { mode: 'number' }),
  evidenceSegmentIds: uuid('evidence_segment_ids').array().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
