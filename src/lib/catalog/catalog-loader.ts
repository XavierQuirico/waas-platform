// ============================================================
// Catalog Loader
// Fuente primaria: addon_catalog + addon_catalog_plan_rules (DB)
// Fallback: src/db/seeds/catalog-defaults.json
// No contiene reglas comerciales complejas — solo normaliza shape.
// ============================================================

import type { CatalogEntry, CatalogPlanRule, CalculatorCatalogResult, CatalogCalculatorItem, ProposalCatalogSnapshot, SnapshotCapability, SubscriptionPlan } from './types';

// ─── Seed fallback (lazy-loaded once) ────────────────────

let _seedCache: CatalogEntry[] | null = null;

function loadSeedFallback(): CatalogEntry[] {
  if (_seedCache) return _seedCache;
  // Use a relative path so this resolves in both Next.js (with @/ alias) and Vitest.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../db/seeds/catalog-defaults.json') as {
    capabilities: Array<{
      code: string;
      internalName: string;
      publicName: string;
      internalCategory: string;
      source: string;
      pricingMode: string;
      priceCents: number;
      listPriceCents: number;
      visibleInCalculator: boolean;
      visibleInProposals: boolean;
      planRules: Record<string, {
        availability: string;
        inclusionScope: string | null;
        initialIncludedQty: number;
        recurringIncludedQty: number;
        overageMode: string;
        overageAddonCode: string | null;
        allowedRequestKinds: string[];
      }>;
      adminNotes?: string | null;
    }>;
  };

  _seedCache = raw.capabilities.map((cap) => {
    const planRules: CatalogEntry['planRules'] = {};
    for (const [plan, rule] of Object.entries(cap.planRules)) {
      planRules[plan as SubscriptionPlan] = {
        availability: rule.availability as CatalogPlanRule['availability'],
        inclusionScope: rule.inclusionScope as CatalogPlanRule['inclusionScope'],
        initialIncludedQty: rule.initialIncludedQty,
        recurringIncludedQty: rule.recurringIncludedQty,
        recurringPeriod: null,
        overageMode: rule.overageMode as CatalogPlanRule['overageMode'],
        overageAddonCode: rule.overageAddonCode,
        allowedRequestKinds: rule.allowedRequestKinds as CatalogPlanRule['allowedRequestKinds'],
      };
    }
    return {
      id: `seed_${cap.code}`,
      code: cap.code,
      name: cap.internalName,
      publicName: cap.publicName,
      category: cap.internalCategory,
      source: cap.source,
      pricingMode: cap.pricingMode as CatalogEntry['pricingMode'],
      priceCents: cap.priceCents,
      listPriceCents: cap.listPriceCents,
      active: true,
      visibleInCalculator: cap.visibleInCalculator,
      visibleInProposals: cap.visibleInProposals,
      planRules,
      adminNotes: cap.adminNotes ?? null,
    } satisfies CatalogEntry;
  });

  return _seedCache;
}

// ─── DB loader (server-only) ──────────────────────────────

async function loadFromDB(): Promise<CatalogEntry[] | null> {
  try {
    const { db } = await import('@/db');
    const { addonCatalog, addonCatalogPlanRules } = await import('@/db/schema/addon-catalog');

    const [items, rules] = await Promise.all([
      db.select().from(addonCatalog),
      db.select().from(addonCatalogPlanRules),
    ]);

    // Group rules by addonCatalogId
    const rulesByItemId = new Map<string, typeof rules>();
    for (const r of rules) {
      const arr = rulesByItemId.get(r.addonCatalogId) ?? [];
      arr.push(r);
      rulesByItemId.set(r.addonCatalogId, arr);
    }

    return items.map((item) => {
      const planRules: CatalogEntry['planRules'] = {};
      for (const r of (rulesByItemId.get(item.id) ?? [])) {
        planRules[r.plan as SubscriptionPlan] = {
          availability: r.availability,
          inclusionScope: r.inclusionScope ?? null,
          initialIncludedQty: r.initialIncludedQty,
          recurringIncludedQty: r.recurringIncludedQty,
          recurringPeriod: r.recurringPeriod ?? null,
          overageMode: r.overageMode,
          overageAddonCode: r.overageAddonCode ?? null,
          allowedRequestKinds: (r.allowedRequestKinds ?? []) as CatalogPlanRule['allowedRequestKinds'],
        };
      }
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        publicName: item.publicName ?? item.name,
        category: item.category,
        source: item.source,
        pricingMode: item.pricingMode,
        priceCents: item.priceCents,
        listPriceCents: item.listPriceCents,
        active: item.active,
        visibleInCalculator: item.visibleInCalculator,
        visibleInProposals: item.visibleInProposals,
        planRules,
        adminNotes: item.adminNotes ?? null,
      } satisfies CatalogEntry;
    });
  } catch {
    return null;
  }
}

// ─── Public loader functions ──────────────────────────────

/**
 * Returns all active catalog entries visible in the calculator for a given plan.
 * Uses DB when available, falls back to seed.
 */
export async function getCatalogForCalculator(plan: SubscriptionPlan): Promise<CalculatorCatalogResult> {
  const entries = (await loadFromDB()) ?? loadSeedFallback();
  return buildCalculatorResult(entries, plan);
}

/**
 * Returns catalog entries serialized for intake use (no DB required).
 * Always usable from client-side/test/build contexts.
 */
export function getCatalogForIntake(): CatalogEntry[] {
  return loadSeedFallback();
}

/**
 * Builds a proposal catalog snapshot for the given plan and optional selected codes.
 * Uses DB when available, falls back to seed.
 */
export async function getCatalogSnapshotForProposal(
  plan: SubscriptionPlan,
  selectedCodes?: string[]
): Promise<ProposalCatalogSnapshot> {
  const entries = (await loadFromDB()) ?? loadSeedFallback();
  return buildProposalSnapshot(entries, plan, selectedCodes);
}

// ─── Calculator computation ───────────────────────────────

export function buildCalculatorResult(
  entries: CatalogEntry[],
  plan: SubscriptionPlan
): CalculatorCatalogResult {
  const included: CatalogCalculatorItem[] = [];
  const paid: CatalogCalculatorItem[] = [];
  const quoteRequired: CatalogCalculatorItem[] = [];
  const unavailable: CatalogCalculatorItem[] = [];

  for (const entry of entries) {
    // Skip inactive or hidden from calculator
    if (!entry.active) continue;
    if (!entry.visibleInCalculator) continue;

    const rule = entry.planRules[plan];
    const item = resolveCalculatorItem(entry, rule);

    switch (item.availability) {
      case 'included':
        included.push(item);
        break;
      case 'paid':
        paid.push(item);
        break;
      case 'quote':
        quoteRequired.push(item);
        break;
      default:
        unavailable.push(item);
        break;
    }
  }

  const paidAddOnsCents = paid.reduce((s, i) => s + (i.priceCents ?? 0), 0);
  const includedValueCents = included.reduce((s, i) => s + i.listPriceCents, 0);
  const quoteCount = quoteRequired.length;

  return {
    included,
    paid,
    quoteRequired,
    unavailable,
    totals: { paidAddOnsCents, includedValueCents, quoteCount },
  };
}

function resolveCalculatorItem(
  entry: CatalogEntry,
  rule: CatalogPlanRule | undefined
): CatalogCalculatorItem {
  const base = {
    catalogItemId: entry.id,
    code: entry.code,
    name: entry.name,
    category: entry.category,
    source: entry.source,
    pricingMode: entry.pricingMode,
    listPriceCents: entry.listPriceCents,
  };

  // Rule exists and dictates availability
  if (rule) {
    if (rule.availability === 'included') {
      return {
        ...base,
        availability: 'included',
        priceCents: null,
        reason: rule.inclusionScope === 'recurring_allowance'
          ? 'Cupo mensual incluido en tu plan'
          : 'Incluido en el setup inicial de tu plan',
      };
    }
    if (rule.availability === 'paid') {
      return {
        ...base,
        availability: 'paid',
        priceCents: entry.priceCents,
        reason: 'Disponible como add-on cobrable',
      };
    }
    if (rule.availability === 'quote') {
      return {
        ...base,
        availability: 'quote',
        priceCents: null,
        reason: 'Requiere cotización personalizada',
      };
    }
    // unavailable by rule
    return {
      ...base,
      availability: 'unavailable',
      priceCents: null,
      reason: `No disponible en tu plan actual`,
    };
  }

  // No rule — fall back to pricingMode
  if (entry.pricingMode === 'fixed') {
    return {
      ...base,
      availability: 'paid',
      priceCents: entry.priceCents,
      reason: 'Disponible como add-on cobrable (sin regla de plan específica)',
    };
  }
  if (entry.pricingMode === 'quote') {
    return {
      ...base,
      availability: 'quote',
      priceCents: null,
      reason: 'Requiere cotización — consulta disponibilidad',
    };
  }
  // pricingMode === 'included' without an explicit rule → do not assume free
  return {
    ...base,
    availability: 'unavailable',
    priceCents: null,
    reason: 'Requiere regla de plan explícita para este plan',
  };
}

// ─── Proposal snapshot builder ────────────────────────────

export function buildProposalSnapshot(
  entries: CatalogEntry[],
  plan: SubscriptionPlan,
  selectedCodes?: string[]
): ProposalCatalogSnapshot {
  const included: SnapshotCapability[] = [];
  const recommendedAddOns: SnapshotCapability[] = [];
  const quoteRequired: SnapshotCapability[] = [];

  const selectedSet = selectedCodes ? new Set(selectedCodes) : null;

  for (const entry of entries) {
    if (!entry.active) continue;
    if (!entry.visibleInProposals) continue;

    const rule = entry.planRules[plan];
    if (!rule) continue;

    const snap: SnapshotCapability = {
      catalogItemId: entry.id,
      code: entry.code,
      name: entry.name,
      publicName: entry.publicName,
      source: entry.source,
      category: entry.category,
      pricingMode: entry.pricingMode,
      availability: rule.availability,
      inclusionScope: rule.inclusionScope ?? null,
      priceCents: rule.availability === 'paid' ? entry.priceCents : null,
      listPriceCents: entry.listPriceCents,
      reason: '',
    };

    if (rule.availability === 'included') {
      snap.reason = rule.inclusionScope === 'recurring_allowance'
        ? 'Cupo mensual incluido en tu plan'
        : 'Incluido en el setup de tu plan';
      included.push(snap);
    } else if (rule.availability === 'paid') {
      // Only include in recommendedAddOns if explicitly selected (or no filter applied)
      if (!selectedSet || selectedSet.has(entry.code)) {
        snap.reason = 'Add-on recomendado para tu proyecto';
        recommendedAddOns.push(snap);
      }
    } else if (rule.availability === 'quote') {
      snap.reason = 'Requiere cotización personalizada';
      quoteRequired.push(snap);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    plan,
    included,
    recommendedAddOns,
    quoteRequired,
  };
}
