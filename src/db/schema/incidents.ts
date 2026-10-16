// ============================================================
// Drizzle ORM Schema — Incidents
// Propósito: Sistema de incidencias del cliente y monitoreo
// Severidades: P1 (24/7 2h), P2 (hábil 4h), P3 (hábil 24h)
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

export const incidentStatusEnum = pgEnum('incident_status', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
]);

export const incidentReporterEnum = pgEnum('incident_reporter', [
  'CLIENT',    // Desde el portal del cliente
  'ADMIN',    // El admin desde admin (incl. lo reportado por WhatsApp)
  'SYSTEM',    // UptimeRobot webhook automático
]);

export const incidentSeverityEnum = pgEnum('incident_severity', [
  'P1', // Sitio caído / datos críticos — SLA 2h, 24/7 (fines de semana incluidos)
  'P2', // Funcionalidad crítica rota — SLA 4h, horario hábil L-V 9am-6pm
  'P3', // Error menor / estético — SLA 24h, horario hábil L-V 9am-6pm
]);

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),
  description: text('description'),
  affectedUrl: text('affected_url'),
  evidenceUrl: text('evidence_url'),

  status: incidentStatusEnum('status').notNull().default('OPEN'),
  severity: incidentSeverityEnum('severity').notNull().default('P3'),
  reportedBy: incidentReporterEnum('reported_by').notNull(),

  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedNote: text('resolved_note'),

  // Al resolver, el admin elige si notificar al cliente (dispara E20)
  notifyClientOnResolve: boolean('notify_client_on_resolve').notNull().default(true),
  clientNotifiedAt: timestamp('client_notified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
