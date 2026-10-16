// ============================================================
// Drizzle ORM Schema — Event Log de Proyectos WaaS
// Propósito: Auditoría inmutable de todas las transiciones de estado
// y acciones sobre assets. Fuente de verdad para historial.
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';
import { projectStatusEnum } from './projects';
import { assetKeyEnum } from './project-assets';

// ─── Tipos de evento ──────────────────────────────────────
export const projectEventTypeEnum = pgEnum('project_event_type', [
  'status_changed',
  'asset_uploaded',
  'asset_approved',
  'asset_rejected',
  'assets_submitted_for_review',
  'production_started',
  'staging_deployed',
  'staging_feedback_submitted',
  'revision_completed',
  'proposal_sent',
  'proposal_expired',
  'comment_added',
  'email_sent',
  'payment_received',
]);

// ─── Tabla de eventos (append-only — nunca UPDATE ni DELETE) ─
export const projectEvents = pgTable('project_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  eventType: projectEventTypeEnum('event_type').notNull(),

  // Actor
  actorType: text('actor_type').notNull(), // 'client' | 'admin' | 'system'
  actorId: text('actor_id'),               // clerkUserId (null para 'system')

  // Datos de transición de estado (si aplica)
  fromStatus: projectStatusEnum('from_status'),
  toStatus: projectStatusEnum('to_status'),

  // Asset relacionado (si aplica)
  assetKey: assetKeyEnum('asset_key'),

  // Payload flexible para datos adicionales
  metadata: jsonb('metadata'),

  // SOLO createdAt — esta tabla es inmutable
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ProjectEvent = typeof projectEvents.$inferSelect;
export type NewProjectEvent = typeof projectEvents.$inferInsert;
