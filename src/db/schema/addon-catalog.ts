// ============================================================
// Drizzle ORM Schema - Commercial Capability Catalog
// Catalogo editable desde admin y fuente de reglas comerciales.
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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { subscriptionPlanEnum } from './projects';

export const addonCategoryEnum = pgEnum('addon_category', [
  'design',
  'content',
  'integration',
  'revision',
  'custom',
]);

export const catalogSourceEnum = pgEnum('catalog_source', [
  'waas_ticket',
  'legacy_calculator',
  'manual',
  'legacy_scope',
]);

export const catalogPricingModeEnum = pgEnum('catalog_pricing_mode', [
  'included',
  'fixed',
  'quote',
]);

export const catalogAvailabilityEnum = pgEnum('catalog_availability', [
  'included',
  'paid',
  'quote',
  'unavailable',
]);

export const catalogInclusionScopeEnum = pgEnum('catalog_inclusion_scope', [
  'initial_setup',
  'recurring_allowance',
]);

export const catalogRecurringPeriodEnum = pgEnum('catalog_recurring_period', [
  'calendar_month',
]);

export const catalogOverageModeEnum = pgEnum('catalog_overage_mode', [
  'paid',
  'quote',
  'unavailable',
]);

export const portalCategories = pgTable('portal_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  publicName: text('public_name').notNull(),
  description: text('description'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  // Disabled capabilities are represented by active=false, not by pricingMode.
  active: boolean('active').notNull().default(true),
  visibilityRule: text('visibility_rule').notNull().default('always'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const addonCatalog = pgTable('addon_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Legacy fields kept for existing calculator/ticket screens.
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  category: addonCategoryEnum('category').notNull().default('custom'),
  active: boolean('active').notNull().default(true),

  // Commercial catalog V3 fields.
  source: catalogSourceEnum('source').notNull().default('manual'),
  pricingMode: catalogPricingModeEnum('pricing_mode').notNull().default('fixed'),
  listPriceCents: integer('list_price_cents').notNull().default(0),
  publicName: text('public_name'),
  publicDescription: text('public_description'),
  visibleInCalculator: boolean('visible_in_calculator').notNull().default(true),
  visibleInTickets: boolean('visible_in_tickets').notNull().default(true),
  visibleInProposals: boolean('visible_in_proposals').notNull().default(true),
  visibleInPortal: boolean('visible_in_portal').notNull().default(false),
  portalCategoryId: text('portal_category_id').references(() => portalCategories.id, {
    onDelete: 'set null',
  }),
  sortOrder: integer('sort_order').notNull().default(0),
  adminNotes: text('admin_notes'),
  dependencies: jsonb('dependencies').$type<string[]>(),
  conflicts: jsonb('conflicts').$type<Array<string | null>>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const addonCatalogPlanRules = pgTable('addon_catalog_plan_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  addonCatalogId: uuid('addon_catalog_id')
    .notNull()
    .references(() => addonCatalog.id, { onDelete: 'cascade' }),
  plan: subscriptionPlanEnum('plan').notNull(),
  availability: catalogAvailabilityEnum('availability').notNull(),
  inclusionScope: catalogInclusionScopeEnum('inclusion_scope'),
  initialIncludedQty: integer('initial_included_qty').notNull().default(0),
  recurringIncludedQty: integer('recurring_included_qty').notNull().default(0),
  recurringPeriod: catalogRecurringPeriodEnum('recurring_period'),
  overageMode: catalogOverageModeEnum('overage_mode').notNull().default('unavailable'),
  overageAddonCode: text('overage_addon_code'),
  allowedRequestKinds: jsonb('allowed_request_kinds').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  addonPlanIdx: uniqueIndex('addon_catalog_plan_rules_addon_plan_idx').on(
    table.addonCatalogId,
    table.plan,
  ),
}));

export type AddonCatalogItem = typeof addonCatalog.$inferSelect;
export type NewAddonCatalogItem = typeof addonCatalog.$inferInsert;
export type AddonCatalogPlanRule = typeof addonCatalogPlanRules.$inferSelect;
export type NewAddonCatalogPlanRule = typeof addonCatalogPlanRules.$inferInsert;
export type PortalCategory = typeof portalCategories.$inferSelect;
export type NewPortalCategory = typeof portalCategories.$inferInsert;

export const catalogAdminEvents = pgTable('catalog_admin_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CatalogAdminEvent = typeof catalogAdminEvents.$inferSelect;
export type NewCatalogAdminEvent = typeof catalogAdminEvents.$inferInsert;
