import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'
import { highlights } from './highlights.js'
import { users } from './users.js'

export const shareLinkKindEnum = pgEnum('share_link_kind', ['meeting', 'clip'])
export const shareLinkStatusEnum = pgEnum('share_link_status', ['active', 'revoked'])

export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  highlightId: uuid('highlight_id').references(() => highlights.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  kind: shareLinkKindEnum('kind').notNull(),
  tokenHash: text('token_hash').unique().notNull(),
  status: shareLinkStatusEnum('status').notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  allowTranscript: boolean('allow_transcript').notNull().default(true),
  allowSummary: boolean('allow_summary').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
