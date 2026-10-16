// ============================================================
// Tests — calculadora, intake y propuestas
// Cubre: catalog-loader (buildCalculatorResult, buildProposalSnapshot)
//        plan-detector (suggestedAddOnToCatalogCode, nuevos proyectos)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  buildCalculatorResult,
  buildProposalSnapshot,
  getCatalogForIntake,
} from '@/lib/catalog/catalog-loader';
import {
  detectPlan,
  suggestedAddOnToCatalogCode,
} from '@/lib/intake/plan-detector';
import type { CatalogEntry, CatalogPlanRule } from '@/lib/catalog/types';
import type { FeatureChecklist } from '@/lib/intake/types';

// ─── Test fixtures ────────────────────────────────────────

function makePlanRule(availability: CatalogPlanRule['availability'], opts: Partial<CatalogPlanRule> = {}): CatalogPlanRule {
  return {
    availability,
    inclusionScope: opts.inclusionScope ?? null,
    initialIncludedQty: opts.initialIncludedQty ?? 0,
    recurringIncludedQty: opts.recurringIncludedQty ?? 0,
    recurringPeriod: opts.recurringPeriod ?? null,
    overageMode: opts.overageMode ?? 'unavailable',
    overageAddonCode: opts.overageAddonCode ?? null,
    allowedRequestKinds: opts.allowedRequestKinds ?? [],
  };
}

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'test_id',
    code: 'T01',
    name: 'Test Item',
    publicName: 'Test Item Public',
    category: 'custom',
    source: 'manual',
    pricingMode: 'fixed',
    priceCents: 5000,
    listPriceCents: 10000,
    active: true,
    visibleInCalculator: true,
    visibleInProposals: true,
    planRules: {},
    ...overrides,
  };
}

const noFeatures: FeatureChecklist = {
  needsBooking: false,
  needsCatalog: false,
  needsCheckout: false,
  needsBlog: false,
  needsCrmIntegration: false,
  needsMultiEmployeeCalendar: false,
  wantsOwnership: false,
};

// ─── Calculadora ──────────────────────────────────────────

describe('buildCalculatorResult — Calculadora', () => {
  it('item inactive → no aparece en ningún bloque', () => {
    const entries = [makeEntry({ active: false })];
    const result = buildCalculatorResult(entries, 'BASIC');
    expect(result.included).toHaveLength(0);
    expect(result.paid).toHaveLength(0);
    expect(result.quoteRequired).toHaveLength(0);
    expect(result.unavailable).toHaveLength(0);
  });

  it('item visibleInCalculator=false → no aparece', () => {
    const entries = [makeEntry({ visibleInCalculator: false })];
    const result = buildCalculatorResult(entries, 'BASIC');
    expect(result.included).toHaveLength(0);
    expect(result.paid).toHaveLength(0);
  });

  it('item con regla included → va a included, no suma al total', () => {
    const entry = makeEntry({
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.included).toHaveLength(1);
    expect(result.totals.paidAddOnsCents).toBe(0);
  });

  it('item included → listPriceCents suma a includedValueCents', () => {
    const entry = makeEntry({
      listPriceCents: 10000,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.totals.includedValueCents).toBe(10000);
  });

  it('item fixed sin regla de plan → va a paid', () => {
    const entry = makeEntry({ pricingMode: 'fixed', planRules: {} });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.paid).toHaveLength(1);
    expect(result.totals.paidAddOnsCents).toBe(entry.priceCents);
  });

  it('item fixed con regla paid → va a paid y suma priceCents', () => {
    const entry = makeEntry({
      priceCents: 3000,
      planRules: { PRO: makePlanRule('paid') },
    });
    const result = buildCalculatorResult([entry], 'PRO');
    expect(result.paid).toHaveLength(1);
    expect(result.totals.paidAddOnsCents).toBe(3000);
  });

  it('item quote con regla quote → va a quoteRequired, precio null', () => {
    const entry = makeEntry({
      pricingMode: 'quote',
      planRules: { BUSINESS: makePlanRule('quote') },
    });
    const result = buildCalculatorResult([entry], 'BUSINESS');
    expect(result.quoteRequired).toHaveLength(1);
    expect(result.quoteRequired[0]!.priceCents).toBeNull();
    expect(result.totals.paidAddOnsCents).toBe(0);
  });

  it('item quote sin regla de plan → quoteRequired (fallback pricingMode)', () => {
    const entry = makeEntry({ pricingMode: 'quote', planRules: {} });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.quoteRequired).toHaveLength(1);
  });

  it('item pricingMode=included sin regla → unavailable (no se asume gratis)', () => {
    const entry = makeEntry({ pricingMode: 'included', planRules: {} });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.unavailable).toHaveLength(1);
    expect(result.totals.paidAddOnsCents).toBe(0);
  });

  it('item incluido no suma al total pagado; cotizable tampoco', () => {
    const included = makeEntry({
      code: 'INC',
      pricingMode: 'included',
      priceCents: 9999,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const quote = makeEntry({
      code: 'QUO',
      id: 'q2',
      pricingMode: 'quote',
      priceCents: 5000,
      planRules: { BASIC: makePlanRule('quote') },
    });
    const paid = makeEntry({
      code: 'PAD',
      id: 'p3',
      pricingMode: 'fixed',
      priceCents: 2000,
      planRules: { BASIC: makePlanRule('paid') },
    });
    const result = buildCalculatorResult([included, quote, paid], 'BASIC');
    expect(result.totals.paidAddOnsCents).toBe(2000);
    expect(result.totals.quoteCount).toBe(1);
  });

  it('item con regla unavailable → va a unavailable', () => {
    const entry = makeEntry({
      planRules: { BASIC: makePlanRule('unavailable') },
    });
    const result = buildCalculatorResult([entry], 'BASIC');
    expect(result.unavailable).toHaveLength(1);
  });
});

// ─── Intake / Plan Detector ───────────────────────────────

describe('detectPlan + catalog', () => {
  it('suggestedAddOnToCatalogCode mapea key a código de catálogo', () => {
    expect(suggestedAddOnToCatalogCode('C01_copywriting')).toBe('C01');
    expect(suggestedAddOnToCatalogCode('C02_blog_engine')).toBe('C02A');
    expect(suggestedAddOnToCatalogCode('I01_crm_sync')).toBe('I01');
    expect(suggestedAddOnToCatalogCode('I02_advanced_booking')).toBe('I02');
  });

  it('suggestedAddOnToCatalogCode devuelve null para clave desconocida', () => {
    expect(suggestedAddOnToCatalogCode('UNKNOWN_KEY')).toBeNull();
  });

  it('detectPlan devuelve addOns con catalogCode válido para needsBlog', () => {
    const result = detectPlan({ ...noFeatures, needsBlog: true });
    const codes = result.suggestedAddOns.map((a) => suggestedAddOnToCatalogCode(a.key));
    expect(codes).toContain('C02A');
  });

  it('fallback seed está disponible para intake sin DB', () => {
    const entries = getCatalogForIntake();
    expect(entries.length).toBeGreaterThan(0);
    // Every entry must have a code
    expect(entries.every((e) => typeof e.code === 'string' && e.code.length > 0)).toBe(true);
  });

  it('fallback seed tiene entries con planRules', () => {
    const entries = getCatalogForIntake();
    const withRules = entries.filter((e) => Object.keys(e.planRules).length > 0);
    expect(withRules.length).toBeGreaterThan(0);
  });
});

// ─── Propuestas ───────────────────────────────────────────

describe('buildProposalSnapshot — Propuestas', () => {
  it('bloque included aparece cuando hay regla included', () => {
    const entry = makeEntry({
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.included).toHaveLength(1);
    expect(snapshot.recommendedAddOns).toHaveLength(0);
    expect(snapshot.quoteRequired).toHaveLength(0);
  });

  it('bloque recommendedAddOns aparece para availability=paid', () => {
    const entry = makeEntry({
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('paid') },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.recommendedAddOns).toHaveLength(1);
  });

  it('bloque quoteRequired aparece para availability=quote', () => {
    const entry = makeEntry({
      visibleInProposals: true,
      pricingMode: 'quote',
      planRules: { BASIC: makePlanRule('quote') },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.quoteRequired).toHaveLength(1);
    // Quote items have no price
    expect(snapshot.quoteRequired[0]!.priceCents).toBeNull();
  });

  it('incluidos no tienen priceCents (no suman al total)', () => {
    const entry = makeEntry({
      priceCents: 9999,
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.included[0]!.priceCents).toBeNull();
  });

  it('add-ons seleccionados sí tienen priceCents', () => {
    const entry = makeEntry({
      priceCents: 3000,
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('paid') },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC', ['T01']);
    expect(snapshot.recommendedAddOns[0]!.priceCents).toBe(3000);
  });

  it('snapshot preserva generatedAt como ISO string', () => {
    const entry = makeEntry({
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(typeof snapshot.generatedAt).toBe('string');
    expect(() => new Date(snapshot.generatedAt)).not.toThrow();
  });

  it('items sin regla de plan no aparecen en snapshot', () => {
    const entry = makeEntry({
      visibleInProposals: true,
      planRules: {}, // No rule for BASIC
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.included).toHaveLength(0);
    expect(snapshot.recommendedAddOns).toHaveLength(0);
    expect(snapshot.quoteRequired).toHaveLength(0);
  });

  it('items inactive no aparecen en snapshot', () => {
    const entry = makeEntry({
      active: false,
      visibleInProposals: true,
      planRules: { BASIC: makePlanRule('included', { inclusionScope: 'initial_setup' }) },
    });
    const snapshot = buildProposalSnapshot([entry], 'BASIC');
    expect(snapshot.included).toHaveLength(0);
  });

  it('snapshot para filtro selectedCodes: only paid items in selectedCodes appear in recommendedAddOns', () => {
    const a = makeEntry({ code: 'A01', id: 'a', visibleInProposals: true, planRules: { BASIC: makePlanRule('paid') } });
    const b = makeEntry({ code: 'B01', id: 'b', visibleInProposals: true, planRules: { BASIC: makePlanRule('paid') } });
    const snapshot = buildProposalSnapshot([a, b], 'BASIC', ['A01']);
    expect(snapshot.recommendedAddOns.map((x) => x.code)).toContain('A01');
    expect(snapshot.recommendedAddOns.map((x) => x.code)).not.toContain('B01');
  });
});

// ─── Regresión: plan-detector (tests existentes siguen pasando) ──

describe('detectPlan — regresión (no romper)', () => {
  it('ninguna feature → BASIC', () => {
    expect(detectPlan(noFeatures).plan).toBe('BASIC');
  });
  it('needsCheckout → BUSINESS', () => {
    expect(detectPlan({ ...noFeatures, needsCheckout: true }).plan).toBe('BUSINESS');
  });
  it('needsBooking → PRO', () => {
    expect(detectPlan({ ...noFeatures, needsBooking: true }).plan).toBe('PRO');
  });
  it('wantsOwnership → LEGACY', () => {
    expect(detectPlan({ ...noFeatures, wantsOwnership: true }).plan).toBe('LEGACY');
  });
  it('no_tiene_nada → C01_copywriting suggestion', () => {
    const r = detectPlan(noFeatures, 'no_tiene_nada');
    expect(r.suggestedAddOns.map((a) => a.key)).toContain('C01_copywriting');
  });
});
