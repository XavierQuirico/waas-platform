// ============================================================
// Drizzle ORM Schema — Proyectos WaaS
// State machine: src/lib/projects/state-machine.ts
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
} from 'drizzle-orm/pg-core';

import { clients } from './clients';
import type { IntakeFormData } from '@/lib/intake/types';

// El snapshot del intake es JSON de forma libre: el wizard V2, el flujo legacy y las
// herramientas de desarrollo guardan campos distintos. Los campos conocidos son opcionales.
export type IntakeSnapshot = Partial<IntakeFormData> & Record<string, unknown>;
import type { ProposalCatalogSnapshot } from '@/lib/catalog/types';

// ─── Enums ────────────────────────────────────────────────

export const subscriptionPlanEnum = pgEnum('subscription_plan', [
  'BASIC',
  'PRO',
  'BUSINESS',
  'LEGACY',
]);

// 17 estados — ver src/lib/projects/state-machine.ts para transiciones permitidas
export const projectStatusEnum = pgEnum('project_status', [
  'DRAFT',               // Intake iniciado, no enviado
  'PROPOSAL_SENT',       // El admin envió propuesta (borrador personalizado)
  'REQUIRES_REVIEW',     // Ruta LEGACY: necesita llamada con el admin
  'PAYMENT_RECEIVED',    // PayPal webhook confirmado (order + subscription)
  'AWAITING_ASSETS',     // Email de bienvenida enviado, portal M3 desbloqueado
  'ASSETS_SUBMITTED',    // Cliente envió assets; El admin no ha revisado aún
  'ASSETS_UNDER_REVIEW', // El admin abrió la cola de revisión
  'ASSETS_INCOMPLETE',   // El admin rechazó ≥1 asset — cliente debe re-subir
  'PRODUCTION_STARTED',  // El admin presionó "Iniciar producción" — timer 72h arranca
  'STAGING_REVIEW',      // Sitio desplegado en staging, ventana de revisión abierta
  'REVISIONS',           // Cliente envió feedback con cambios solicitados
  'REVISIONS_DONE',      // El admin marcó revisiones como completas
  'LIVE',                // DNS configurado, suscripción activa
  'SUSPENDED',           // Pago fallido — 3 días de gracia
  'CANCELLED',           // Proyecto abortado (no confundir con CLOSED)
  'PROPOSAL_EXPIRED',    // 7 días sin respuesta del cliente
  'CLOSED',              // LEGACY: proyecto entregado y cerrado exitosamente (estado 17)
]);

// Tipo de hosting del sitio entregado
export const hostingProviderEnum = pgEnum('hosting_provider', [
  'vercel',
  'external',
]);

// ─── Tabla de proyectos ───────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),

  // Plan y facturación
  plan: subscriptionPlanEnum('plan').notNull(),
  monthlyPriceCents: integer('monthly_price_cents').notNull(),
  setupFeeCents: integer('setup_fee_cents').notNull().default(5000), // $50 USD
  suggestedAddOns: jsonb('suggested_add_ons').$type<string[]>(), // add-ons del plan-detector

  // PayPal — dos entidades separadas
  paypalOrderId: text('paypal_order_id'),       // setup fee (one-time, payment.capture)
  paypalSubscriptionId: text('paypal_subscription_id'), // mensual (billing.subscription.activated)

  // Estado
  status: projectStatusEnum('status').notNull().default('DRAFT'),

  // Propuesta (generada por wizard, personalizada por el admin)
  proposalSentAt: timestamp('proposal_sent_at', { withTimezone: true }),
  proposalExpiresAt: timestamp('proposal_expires_at', { withTimezone: true }), // +7 días desde envío

  // SLA de producción (72h hábiles, motor en src/lib/sla/business-hours.ts)
  productionStartedAt: timestamp('production_started_at', { withTimezone: true }),
  productionDeadlineAt: timestamp('production_deadline_at', { withTimezone: true }),

  // SLA de revisión de staging (72h hábiles desde despliegue)
  stagingDeployedAt: timestamp('staging_deployed_at', { withTimezone: true }),
  stagingReviewDeadlineAt: timestamp('staging_review_deadline_at', { withTimezone: true }),

  // Fechas clave
  liveAt: timestamp('live_at', { withTimezone: true }),

  // Snapshot del intake (M1 + M2) — inmutable, fuente de verdad de la propuesta
  intakeSnapshot: jsonb('intake_snapshot').$type<IntakeSnapshot>(),

  // Snapshot del catálogo (fuente de verdad comercial para la propuesta)
  catalogSnapshot: jsonb('catalog_snapshot').$type<ProposalCatalogSnapshot>(),

  // URLs del sitio
  stagingUrl: text('staging_url'),
  productionUrl: text('production_url'),
  domainTarget: text('domain_target'),

  // Notas internas del admin (nunca se muestran al cliente)
  internalNotes: text('internal_notes'),

  // Términos y condiciones
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  termsAcceptedIp: text('terms_accepted_ip'),
  termsVersion: text('terms_version'),

  // Portfolio flag: proyectos sin cobro (uso de portfolio personal / familiares)
  portfolioFlag: boolean('portfolio_flag').notNull().default(false),

  // Hosting del sitio entregado
  hostingProvider: hostingProviderEnum('hosting_provider').default('vercel'),
  hostingPanelUrl: text('hosting_panel_url'), // URL del panel de control externo (si aplica)

  // Fecha de entrega (LEGACY → CLOSED)
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),

  // Fin de garantia post-lanzamiento para correcciones incluidas.
  postLaunchWarrantyEndsAt: timestamp('post_launch_warranty_ends_at', { withTimezone: true }),

  // Suspensión por pago fallido
  paymentGracePeriodUntil: timestamp('payment_grace_period_until', { withTimezone: true }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  reactivationFeeActive: boolean('reactivation_fee_active').notNull().default(false),

  // Brief del wizard (para detección de conflicto plan vs. necesidades en PAYMENT_RECEIVED)
  wizardBrief: text('wizard_brief'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
