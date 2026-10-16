// ============================================================
// Drizzle ORM Schema — Tickets / Add-ons WaaS
// Propósito: Gestión de add-ons post-lanzamiento solicitados
// por clientes o creados por el admin. Incluye log de eventos.
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { addonCatalog } from './addon-catalog';
import { projects } from './projects';

// ─── Enums ────────────────────────────────────────────────

export const ticketStatusEnum = pgEnum('ticket_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PAYMENT_PENDING',
  'PAID',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]);

export const ticketCreatorEnum = pgEnum('ticket_creator', [
  'CLIENT',
  'ADMIN',
]);

export const addonTypeEnum = pgEnum('addon_type', [
  'QUICK_FIX',
  'NEW_BLOCK',
  'EXTRA_PAGE',
  'MOTION_ANIMATION',
  'COPYWRITING',
  'SEO_BASICO',
  'INTEGRACION_BASICA',
  'INTEGRACION_AVANZADA',
  'CUSTOM',
]);

export const ticketEventTypeEnum = pgEnum('ticket_event_type', [
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'PRICE_UPDATED',
  'PAYPAL_ORDER_CREATED',
  'PAYPAL_WEBHOOK_RECEIVED',
  'QUOTE_SENT',
  'QUOTE_ACCEPTED',
  'QUOTE_DECLINED',
  'QUOTE_EXPIRED',
  'MANUAL_PAYMENT_RECORDED',
  'PAYPAL_CAPTURE_COMPLETED',
  'PAYPAL_RECONCILED',
]);

export const ticketRequestKindEnum = pgEnum('ticket_request_kind', [
  'initial_delivery',
  'change',
  'correction',
  'expansion',
  'maintenance',
  'reactivation',
]);

export const ticketQuoteStatusEnum = pgEnum('ticket_quote_status', [
  'none',
  'requested',
  'needs_info',
  'priced',
  'accepted',
  'declined',
  'expired',
  'rejected',
]);

export const quoteAcceptanceSourceEnum = pgEnum('quote_acceptance_source', [
  'portal',
  'whatsapp',
  'phone',
  'in_person',
  'other',
]);

export const ticketPaymentMethodEnum = pgEnum('ticket_payment_method', [
  'paypal_checkout',
  'bank_transfer',
  'cash',
  'paypal_external',
  'other',
]);

export const ticketEventVisibilityEnum = pgEnum('ticket_event_visibility', [
  'public',    // visible en el portal del cliente
  'internal',  // solo visible para admins
]);

// ─── Tabla de tickets ─────────────────────────────────────
export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),

  // Identificador legible — generado en aplicación (ej. TKT-0042)
  ticketNumber: text('ticket_number').notNull().unique(),

  // Tipo y contenido
  addonCatalogId: uuid('addon_catalog_id').references(() => addonCatalog.id, { onDelete: 'set null' }),
  addonType: addonTypeEnum('addon_type').notNull(),
  requestKind: ticketRequestKindEnum('request_kind').notNull().default('change'),
  title: text('title').notNull(),
  description: text('description'),
  internalNotes: text('internal_notes'), // nunca visible al cliente

  // Precio
  priceAmount: integer('price_amount').notNull(), // en centavos USD
  priceCurrency: text('price_currency').notNull().default('USD'),
  customPriceReason: text('custom_price_reason'),
  billingDecision: text('billing_decision'),
  catalogDecisionSnapshot: jsonb('catalog_decision_snapshot'),
  adminOverrideReason: text('admin_override_reason'),

  // Cotización
  quoteStatus: ticketQuoteStatusEnum('quote_status').notNull().default('none'),
  quoteRevision: integer('quote_revision').notNull().default(0),
  quotedPriceCents: integer('quoted_price_cents'),
  quoteSentAt: timestamp('quote_sent_at', { withTimezone: true }),
  quoteScope: text('quote_scope'),                         // alcance público del presupuesto
  quoteEstimatedBusinessDays: integer('quote_estimated_business_days'),
  quoteResponseNote: text('quote_response_note'),          // respuesta pública vigente
  quoteRespondedAt: timestamp('quote_responded_at', { withTimezone: true }),
  quoteExpiresAt: timestamp('quote_expires_at', { withTimezone: true }),
  quoteAcceptanceSource: quoteAcceptanceSourceEnum('quote_acceptance_source'),

  // Estado y actor
  status: ticketStatusEnum('status').notNull().default('PENDING_APPROVAL'),
  createdBy: ticketCreatorEnum('created_by').notNull(),

  // PayPal
  paypalOrderId: text('paypal_order_id'),
  paypalCaptureId: text('paypal_capture_id'),
  paypalOrderQuoteRevision: integer('paypal_order_quote_revision'),
  paypalOrderAmountCents: integer('paypal_order_amount_cents'),

  // Pago (manual o PayPal verificado)
  paymentMethod: ticketPaymentMethodEnum('payment_method'),
  paymentReference: text('payment_reference'),    // máx 200 chars
  paidAmountCents: integer('paid_amount_cents'),
  paidCurrency: text('paid_currency'),
  paymentRecordedBy: text('payment_recorded_by'), // actorId del admin que registró el pago

  // SLA
  slaHours: integer('sla_hours').notNull().default(48),
  dueAt: timestamp('due_at', { withTimezone: true }),

  // Fechas de ciclo de vida del ticket
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  clientSubmittedAt: timestamp('client_submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  paymentRequestedAt: timestamp('payment_requested_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  // Timestamps de auditoría
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tickets_paypal_order_id_idx').on(table.paypalOrderId),
  uniqueIndex('tickets_paypal_capture_id_uidx').on(table.paypalCaptureId),
  index('tickets_project_status_idx').on(table.projectId, table.status),
]);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

// ─── Tabla de eventos de tickets (append-only) ────────────
export const ticketEvents = pgTable('ticket_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),

  eventType: ticketEventTypeEnum('event_type').notNull(),

  // Transición de estado (si aplica)
  previousStatus: ticketStatusEnum('previous_status'),
  newStatus: ticketStatusEnum('new_status'),

  // Actor
  actorId: text('actor_id').notNull(),   // 'ADMIN' | userId Clerk | 'PAYPAL' | 'SYSTEM'
  actorRole: text('actor_role').notNull(), // 'admin' | 'client' | 'system'

  // Contexto de cotización al momento del evento
  quoteRevision: integer('quote_revision'),
  acceptanceSource: quoteAcceptanceSourceEnum('acceptance_source'),
  paymentMethod: ticketPaymentMethodEnum('payment_method'),
  amountCents: integer('amount_cents'),
  currency: text('currency'),

  // Contenido público — nunca incluye notas internas
  note: text('note'),
  metadata: jsonb('metadata'),

  // Visibilidad: 'public' = portal cliente; 'internal' = solo admin
  visibility: ticketEventVisibilityEnum('visibility').notNull().default('internal'),

  // SOLO createdAt — esta tabla es inmutable
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TicketEvent = typeof ticketEvents.$inferSelect;
export type NewTicketEvent = typeof ticketEvents.$inferInsert;
