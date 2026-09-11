import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { meetings } from './meetings.js'

export const meetingSummaries = pgTable(
  'meeting_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    templateKey: text('template_key').notNull().default('general'),
    version: integer('version').notNull().default(1),
    overview: text('overview').notNull(),
    structuredJson: jsonb('structured_json'),
    modelProvider: text('model_provider').notNull(),
    modelName: text('model_name').notNull(),
    promptVersion: text('prompt_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueMeetingTemplateVersion: unique().on(t.meetingId, t.templateKey, t.version),
  })
)
