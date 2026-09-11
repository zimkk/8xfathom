import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'
import { users } from './users.js'

export const askMessageRoleEnum = pgEnum('ask_message_role', ['user', 'assistant'])

export const askThreads = pgTable('ask_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const askMessages = pgTable('ask_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => askThreads.id, { onDelete: 'cascade' }),
  role: askMessageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
