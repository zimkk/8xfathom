import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
} from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const meetingParticipants = pgTable('meeting_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  providerParticipantId: text('provider_participant_id'),
  displayName: text('display_name').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  isHost: boolean('is_host').notNull().default(false),
  firstJoinedAt: timestamp('first_joined_at', { withTimezone: true }),
  lastLeftAt: timestamp('last_left_at', { withTimezone: true }),
  speakingMs: bigint('speaking_ms', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
