/**
 * scripts/seed-catalog-defaults.ts
 *
 * Seeds the commercial capability catalog from the approved commercial matrix.
 * Usage: npx tsx scripts/seed-catalog-defaults.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import catalogDefaults from '../src/db/seeds/catalog-defaults.json';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';

// Rebase explícito de precios aprobados. Solo corrige el valor heredado exacto
// (onlyIfCurrentIs) para no pisar cambios admin futuros.
const PRICE_REBASE_APPROVED: Array<{ code: string; newPriceCents: number; onlyIfCurrentIs?: number }> = [
  { code: 'WA03', newPriceCents: 9900,  onlyIfCurrentIs: 0 },
  { code: 'T01',  newPriceCents: 0,     onlyIfCurrentIs: 4900 },
  { code: 'I04',  newPriceCents: 9900,  onlyIfCurrentIs: 19900 }, // v1.4.1: catálogo $99
];

const EXPECTED_SEED_VERSION = '1.4.1';

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

type SeedCapability = (typeof catalogDefaults.capabilities)[number];

function toLegacyCategory(category: SeedCapability['internalCategory']) {
  if (category === 'design') return 'design';
  if (category === 'content') return 'content';
  if (category === 'integration') return 'integration';
  if (category === 'revision') return 'revision';
  return 'custom';
}

async function seedPortalCategories() {
  const now = new Date();

  await db
    .insert(schema.portalCategories)
    .values(catalogDefaults.portalCategories.map((category) => ({
      id: category.id,
      name: category.name,
      publicName: category.publicName,
      description: category.description,
      icon: category.icon,
      sortOrder: category.sortOrder,
      active: category.active,
      visibilityRule: category.visibilityRule,
      updatedAt: now,
    })))
    .onConflictDoUpdate({
      target: schema.portalCategories.id,
      set: {
        name: sql`excluded.name`,
        publicName: sql`excluded.public_name`,
        description: sql`excluded.description`,
        icon: sql`excluded.icon`,
        sortOrder: sql`excluded.sort_order`,
        active: sql`excluded.active`,
        visibilityRule: sql`excluded.visibility_rule`,
        updatedAt: now,
      },
    });
}

async function upsertCapability(capability: SeedCapability) {
  const now = new Date();
  const [addon] = await db
    .insert(schema.addonCatalog)
    .values({
      code: capability.code,
      name: capability.internalName,
      description: capability.publicDescription,
      priceCents: capability.priceCents ?? 0,
      category: toLegacyCategory(capability.internalCategory),
      active: true,
      source: capability.source,
      pricingMode: capability.pricingMode,
      listPriceCents: capability.listPriceCents ?? 0,
      publicName: capability.publicName,
      publicDescription: capability.publicDescription,
      visibleInCalculator: capability.visibleInCalculator,
      visibleInTickets: capability.visibleInTickets,
      visibleInProposals: capability.visibleInProposals,
      visibleInPortal: capability.visibleInPortal,
      portalCategoryId: capability.portalCategory,
      sortOrder: 0,
      adminNotes: capability.adminNotes,
      dependencies: capability.dependencies,
      conflicts: capability.conflicts,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.addonCatalog.code,
      set: {
        // NOTE: priceCents and listPriceCents are intentionally excluded to preserve
        // admin-edited operational prices. Use rebaseApprovedPrices() for explicit changes.
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        source: sql`excluded.source`,
        pricingMode: sql`excluded.pricing_mode`,
        publicName: sql`excluded.public_name`,
        publicDescription: sql`excluded.public_description`,
        visibleInCalculator: sql`excluded.visible_in_calculator`,
        visibleInTickets: sql`excluded.visible_in_tickets`,
        visibleInProposals: sql`excluded.visible_in_proposals`,
        visibleInPortal: sql`excluded.visible_in_portal`,
        portalCategoryId: sql`excluded.portal_category_id`,
        adminNotes: sql`excluded.admin_notes`,
        dependencies: sql`excluded.dependencies`,
        conflicts: sql`excluded.conflicts`,
        updatedAt: now,
      },
    })
    .returning({ id: schema.addonCatalog.id });

  return addon.id;
}

async function rebaseApprovedPrices() {
  const now = new Date();
  for (const rebase of PRICE_REBASE_APPROVED) {
    const whereClause = rebase.onlyIfCurrentIs !== undefined
      ? sql`code = ${rebase.code} AND price_cents = ${rebase.onlyIfCurrentIs}`
      : sql`code = ${rebase.code}`;
    await db.execute(
      sql`UPDATE addon_catalog SET price_cents = ${rebase.newPriceCents}, updated_at = ${now} WHERE ${whereClause}`,
    );
  }
}


async function seedPlanRules(addonCatalogId: string, capability: SeedCapability) {
  const now = new Date();

  for (const [plan, rule] of Object.entries(capability.planRules)) {
    await db
      .insert(schema.addonCatalogPlanRules)
      .values({
        addonCatalogId,
        plan: plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
        availability: rule.availability,
        inclusionScope: rule.inclusionScope,
        initialIncludedQty: rule.initialIncludedQty,
        recurringIncludedQty: rule.recurringIncludedQty,
        recurringPeriod: rule.recurringPeriod,
        overageMode: rule.overageMode,
        overageAddonCode: rule.overageAddonCode,
        allowedRequestKinds: rule.allowedRequestKinds,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.addonCatalogPlanRules.addonCatalogId,
          schema.addonCatalogPlanRules.plan,
        ],
        set: {
          availability: sql`excluded.availability`,
          inclusionScope: sql`excluded.inclusion_scope`,
          initialIncludedQty: sql`excluded.initial_included_qty`,
          recurringIncludedQty: sql`excluded.recurring_included_qty`,
          recurringPeriod: sql`excluded.recurring_period`,
          overageMode: sql`excluded.overage_mode`,
          overageAddonCode: sql`excluded.overage_addon_code`,
          allowedRequestKinds: sql`excluded.allowed_request_kinds`,
          updatedAt: now,
        },
      });
  }
}

async function main() {
  if (catalogDefaults.seedVersion !== EXPECTED_SEED_VERSION) {
    throw new Error(`Catalog seed version mismatch: ${catalogDefaults.seedVersion}`);
  }

  await seedPortalCategories();

  for (const capability of catalogDefaults.capabilities) {
    const addonCatalogId = await upsertCapability(capability);
    await seedPlanRules(addonCatalogId, capability);
  }

  await rebaseApprovedPrices();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.addonCatalog);

  console.log(`Catalog seed ${EXPECTED_SEED_VERSION} applied. Addon catalog rows: ${count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
