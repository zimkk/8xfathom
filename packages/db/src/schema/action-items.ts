import { pgTable, uuid, text, timestamp, date, pgEnum } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'
import { meetingParticipants } from './meeting-participants.js'

export const actionItemStatusEnum = pgEnum('action_item_status', ['open', 'done'])
export const actionItemSourceEnum = pgEnum('action_item_source', ['ai', 'user'])

export const actionItems = pgTable('action_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  ownerName: text('owner_name'),
  ownerParticipantId: uuid('owner_participant_id').references(() => meetingParticipants.id, {
    onDelete: 'set null',
  }),
  dueDate: date('due_date'),
  status: actionItemStatusEnum('status').notNull().default('open'),
  evidenceSegmentIds: uuid('evidence_segment_ids').array().notNull().default([]),
  source: actionItemSourceEnum('source').notNull().default('ai'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
