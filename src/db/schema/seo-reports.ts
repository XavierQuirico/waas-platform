// ============================================================
// Drizzle ORM Schema — SEO Reports
// Propósito: Almacena resultados semanales de PageSpeed Insights
// por proyecto LIVE con plan PRO o BUSINESS.
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
} from 'drizzle-orm/pg-core';

import { projects } from './projects';

// ─── Enums ────────────────────────────────────────────────

export const seoCheckStatusEnum = pgEnum('seo_check_status', [
  'ok',
  'site_unreachable',
  'api_error',
]);

// ─── Tipos internos ───────────────────────────────────────

export interface SeoIssue {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
}

// ─── Tabla seo_reports ────────────────────────────────────

export const seoReports = pgTable('seo_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  status: seoCheckStatusEnum('status').notNull().default('ok'),

  // Lighthouse (datos de laboratorio, 0-100)
  lighthouseScore: integer('lighthouse_score'),

  // CrUX (datos de usuarios reales — puede ser null si el sitio tiene poco tráfico)
  // Valores posibles: 'FAST' | 'MODERATE' | 'SLOW' | null
  cruxScore: text('crux_score'),

  // Core Web Vitals (de Lighthouse)
  lcpMs: integer('lcp_ms'),           // Largest Contentful Paint (ms)
  clsScore: real('cls_score'),         // Cumulative Layout Shift (0-0.25+)
  inpMs: integer('inp_ms'),           // Interaction to Next Paint (ms)

  // Top 3 issues técnicos con mayor impacto
  topIssues: jsonb('top_issues').$type<SeoIssue[]>(),

  // Detección de cambios en el sitio
  siteChanged: boolean('site_changed').notNull().default(false),

  // Respuesta raw completa de PageSpeed (mobile) para auditorías futuras
  rawData: jsonb('raw_data'),

  // Control de reporte mensual
  reportSentAt: timestamp('report_sent_at', { withTimezone: true }),
  approvedByAdmin: boolean('approved_by_admin').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SeoReport = typeof seoReports.$inferSelect;
export type NewSeoReport = typeof seoReports.$inferInsert;
