// ============================================================
// Drizzle ORM Schema — Webhook Events (idempotencia PayPal)
// Propósito: Garantizar que cada webhook de PayPal se procese
// exactamente una vez, deduplicando por paypalEventId.
// ============================================================

import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// ─── Tabla de webhook events ──────────────────────────────
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ID de PayPal — UNIQUE garantiza deduplicación
  paypalEventId: text('paypal_event_id').notNull().unique(),
  eventType: text('event_type').notNull(),

  // Referencia al proyecto (nullable si no se puede mapear)
  projectId: uuid('project_id'),

  // Payload original del webhook — fuente de verdad inmutable
  rawPayload: jsonb('raw_payload').notNull(),

  // Semántica de procesamiento:
  // processedAt = null → no procesado exitosamente
  // processedAt != null → procesado con éxito
  processedAt: timestamp('processed_at', { withTimezone: true }),

  // Control de procesamiento concurrente y reintentos
  processingStartedAt: timestamp('processing_started_at', { withTimezone: true }),
  processingAttempts: integer('processing_attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastError: text('last_error'), // sanitizado — sin tokens ni datos sensibles

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('webhook_events_project_id_idx').on(table.projectId),
  index('webhook_events_unprocessed_idx').on(table.processedAt, table.eventType),
]);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
