// ============================================================
// Drizzle ORM Schema — Historial de Cotizaciones WaaS
// Stack: Neon PostgreSQL + Drizzle ORM
// ============================================================

import { pgTable, uuid, text, real, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────
export const projectTypeEnum = pgEnum('project_type', ['subscription', 'legacy']);

export const nicheEnum = pgEnum('niche', [
  'salud',
  'legal',
  'fitness',
  'gastronomia',
  'inmobiliaria',
  'educacion',
  'marca_personal',
  'otro',
]);

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'requires_review',
]);

// ─── Tabla de cotizaciones ────────────────────────────────
export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Datos del cliente
  clientName: text('client_name').notNull(),
  businessName: text('business_name').notNull(),
  projectType: projectTypeEnum('project_type').notNull(),
  niche: nicheEnum('niche').notNull(),
  domainTarget: text('domain_target'),
  clientEmail: text('client_email'),
  clientPhone: text('client_phone'),

  // Estado
  status: quoteStatusEnum('status').notNull().default('draft'),

  // Montos
  totalAmountClient: real('total_amount_client').notNull(),   // Lo que paga el cliente
  totalAmountProvider: real('total_amount_provider').notNull(),   // Neto para el admin
  discountPercent: real('discount_percent').notNull().default(0),
  discountReason: text('discount_reason'),

  // Datos del cálculo (snapshot completo para reproducibilidad)
  componentsSnapshot: jsonb('components_snapshot').notNull().$type<object[]>(),
  calculationSnapshot: jsonb('calculation_snapshot').notNull().$type<object>(),

  // Propuesta generada
  proposalHtml: text('proposal_html').notNull(),
  executiveSummary: text('executive_summary').notNull(),

  // snapshot del catálogo comercial al momento de crear la propuesta
  // Nullable para mantener compatibilidad con propuestas existentes.
  catalogSnapshot: jsonb('catalog_snapshot').$type<object>(),

  // Plan de suscripción (si aplica)
  subscriptionPlan: text('subscription_plan'),

  // Notas internas del admin (nunca se muestran al cliente)
  internalNotes: text('internal_notes'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Tipo inferido ────────────────────────────────────────
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
