// ============================================================
// Drizzle ORM Schema — Feedback de Staging WaaS
// Propósito: Almacenar el feedback estructurado del cliente
// sobre el sitio en staging
// "feedback en formato documentado, no notas de voz de WhatsApp"
// ============================================================

import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

// ─── Tipo del item de feedback ────────────────────────────
export interface StagingFeedbackItem {
  section: string;               // Nombre de la sección del sitio
  status: 'approved' | 'changes'; // Aprobado o necesita cambios
  comment?: string;              // Detalle del cambio (requerido si status = 'changes')
}

// ─── Tabla de feedback de staging ────────────────────────
export const stagingFeedback = pgTable('staging_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Array de feedback por sección
  items: jsonb('items').notNull().$type<StagingFeedbackItem[]>(),

  // true = cliente aprobó todo sin cambios → transición directa a LIVE
  allApproved: jsonb('all_approved').$type<boolean>(),

  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type StagingFeedbackRecord = typeof stagingFeedback.$inferSelect;
export type NewStagingFeedback = typeof stagingFeedback.$inferInsert;
