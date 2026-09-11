import { pgTable, uuid, text, timestamp, bigint, pgEnum } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'
import { users } from './users.js'

export const highlightTypeEnum = pgEnum('highlight_type', [
  'highlight',
  'decision',
  'action',
  'moment',
])

export const highlightSourceEnum = pgEnum('highlight_source', ['user', 'ai', 'extension'])

export const highlights = pgTable('highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  startMs: bigint('start_ms', { mode: 'number' }).notNull(),
  endMs: bigint('end_ms', { mode: 'number' }).notNull(),
  type: highlightTypeEnum('type').notNull().default('highlight'),
  source: highlightSourceEnum('source').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
