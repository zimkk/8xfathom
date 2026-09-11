import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const decisionStatusEnum = pgEnum('decision_status', ['confirmed', 'tentative'])

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  status: decisionStatusEnum('status').notNull().default('confirmed'),
  evidenceSegmentIds: uuid('evidence_segment_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
