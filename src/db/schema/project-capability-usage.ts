// ============================================================
// Drizzle ORM Schema - Project Capability Usage
// Registro idempotente de consumo de capacidades incluidas.
// ============================================================

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import { addonCatalog } from './addon-catalog';
import { projects } from './projects';
import { tickets } from './tickets';

export const projectCapabilityUsage = pgTable('project_capability_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  addonCatalogId: uuid('addon_catalog_id')
    .notNull()
    .references(() => addonCatalog.id, { onDelete: 'cascade' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  usageKey: text('usage_key').notNull(),
  requestKind: text('request_kind').notNull(),
  decision: text('decision').notNull(),
  quantity: integer('quantity').notNull().default(1),
  periodKey: text('period_key'),
  decisionSnapshot: jsonb('decision_snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  usageKeyIdx: uniqueIndex('project_capability_usage_usage_key_idx').on(table.usageKey),
  projectCapabilityIdx: index('project_capability_usage_project_capability_idx').on(
    table.projectId,
    table.addonCatalogId,
  ),
}));

export type ProjectCapabilityUsage = typeof projectCapabilityUsage.$inferSelect;
export type NewProjectCapabilityUsage = typeof projectCapabilityUsage.$inferInsert;
