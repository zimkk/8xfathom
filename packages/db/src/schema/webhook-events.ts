import { pgTable, uuid, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core'

export const webhookEventStatusEnum = pgEnum('webhook_event_status', [
  'received',
  'processed',
  'ignored',
  'failed',
])

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadHash: text('payload_hash').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    status: webhookEventStatusEnum('status').notNull().default('received'),
    error: text('error'),
  },
  (t) => ({
    uniqueProviderEvent: unique().on(t.provider, t.providerEventId),
  })
)

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
