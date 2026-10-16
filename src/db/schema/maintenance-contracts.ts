// ============================================================
// Drizzle ORM Schema — Maintenance Contracts
// Contratos de mantenimiento post-entrega para proyectos LEGACY
// Entidad independiente del proyecto — vinculada a cliente + proyecto CLOSED
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

import { clients } from './clients';
import { projects } from './projects';

export const maintenanceTierEnum = pgEnum('maintenance_tier', [
  'care',      // LM01 Care $49/mes — 1 cambio menor/mes + soporte técnico razonable
  'care_plus', // LM02 Care Plus $89/mes — 2 cambios menores/mes + soporte técnico razonable
  'care_pro',  // LM03 Care Pro $149/mes — 4 cambios menores/mes + revisión técnica recurrente
  'custom',    // Precio manual/caso a caso decidido por el admin
  // MIGRATION PENDING: enum renombrado de basic/standard/premium → care/care_plus/care_pro/custom
]);

export const maintenanceContractStatusEnum = pgEnum('maintenance_contract_status', [
  'active',
  'paused',
  'cancelled',
]);

export const maintenanceBillingMethodEnum = pgEnum('maintenance_billing_method', [
  'paypal_subscription', // PayPal Subscription automático
  'manual',              // Facturación manual (transferencia, Zelle, etc.)
]);

export const maintenanceContracts = pgTable('maintenance_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),

  // El proyecto LEGACY que originó este contrato (debe estar en CLOSED)
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),

  // Tier y pricing
  tier: maintenanceTierEnum('tier').notNull(),
  monthlyPriceCents: integer('monthly_price_cents').notNull(), // precio tier en centavos
  hostingIncluded: boolean('hosting_included').notNull().default(false),
  hostingPriceCents: integer('hosting_price_cents').notNull().default(2000), // LM04 hosting gestionado básico $20/mes. No incluye proveedor externo si aplica.

  // Facturación
  billingMethod: maintenanceBillingMethodEnum('billing_method').notNull().default('paypal_subscription'),
  paypalSubscriptionId: text('paypal_subscription_id'), // si billingMethod = paypal_subscription

  // Estado
  status: maintenanceContractStatusEnum('status').notNull().default('active'),

  // Fechas
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  nextBillingAt: timestamp('next_billing_at', { withTimezone: true }),

  // Notas internas del admin
  notes: text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MaintenanceContract = typeof maintenanceContracts.$inferSelect;
export type NewMaintenanceContract = typeof maintenanceContracts.$inferInsert;
