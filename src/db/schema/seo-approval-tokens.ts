// ============================================================
// Drizzle ORM Schema — SEO Approval Tokens
// Propósito: Magic links de aprobación para el reporte mensual SEO.
// El admin recibe un email con este token (TTL 48h) para aprobar
// el envío del reporte E22 al cliente.
// ============================================================

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

// ─── Tipo del reporte mensual agregado ───────────────────

export interface SeoMonthlyReportData {
  clientName: string;
  businessName: string;
  clientEmail: string;
  productionUrl: string;
  period: string;              // Ej: "junio 2026"
  currentScore: number | null; // Lighthouse score actual (0-100)
  previousScore: number | null;// Lighthouse score mes anterior
  cruxScore: string | null;    // 'FAST' | 'MODERATE' | 'SLOW' | null
  topIssues: Array<{ id: string; title: string; severity: 'high' | 'medium' | 'low' }>;
}

// ─── Tabla seo_approval_tokens ────────────────────────────

export const seoApprovalTokens = pgTable('seo_approval_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Token seguro de 64 chars hex (256 bits de entropía)
  token: text('token').notNull().unique(),

  // Datos del reporte serializado — el email E22 se genera a partir de esto
  reportData: jsonb('report_data').$type<SeoMonthlyReportData>(),

  // Notas opcionales que el admin añade antes de aprobar
  changesApplied: text('changes_applied'),
  contentSuggestions: text('content_suggestions'),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SeoApprovalToken = typeof seoApprovalTokens.$inferSelect;
export type NewSeoApprovalToken = typeof seoApprovalTokens.$inferInsert;
