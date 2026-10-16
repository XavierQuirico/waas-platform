import { describe, expect, it } from 'vitest';
import { resolveEngineDecision } from '@/lib/catalog/engine-decision';

const unavailableRule = {
  availability: 'unavailable' as const,
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'unavailable' as const,
  overageAddonCode: null,
  allowedRequestKinds: ['expansion' as const],
};

const quoteRule = {
  availability: 'quote' as const,
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'unavailable' as const,
  overageAddonCode: null,
  allowedRequestKinds: ['expansion' as const],
};

describe('resolveEngineDecision', () => {
  // ─── Allowance tests ──────────────────────────────────────────────────────

  it('BASIC ajuste rápido (allowance) → included_uses_allowance', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'included_allowance',
      reasonCode: 'recurring_allowance_available',
      planRule: {
        availability: 'included',
        inclusionScope: 'recurring_allowance',
        initialIncludedQty: 0,
        recurringIncludedQty: 1,
        recurringPeriod: 'calendar_month',
        overageMode: 'unavailable',
        overageAddonCode: null,
        allowedRequestKinds: ['change'],
      },
    });
    expect(result.engineDecision).toBe('included_uses_allowance');
  });

  it('PRO ajuste rápido → included_uses_allowance con cupo 2', () => {
    const result = resolveEngineDecision({
      plan: 'PRO',
      decisionCode: 'included_allowance',
      reasonCode: 'recurring_allowance_available',
      planRule: {
        availability: 'included',
        inclusionScope: 'recurring_allowance',
        initialIncludedQty: 0,
        recurringIncludedQty: 2,
        recurringPeriod: 'calendar_month',
        overageMode: 'unavailable',
        overageAddonCode: null,
        allowedRequestKinds: ['change'],
      },
    });
    expect(result.engineDecision).toBe('included_uses_allowance');
  });

  it('BUSINESS actualización catálogo 3 ítems → included_uses_allowance', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'included_allowance',
      reasonCode: 'recurring_allowance_available',
      planRule: {
        availability: 'included',
        inclusionScope: 'recurring_allowance',
        initialIncludedQty: 0,
        recurringIncludedQty: 5,
        recurringPeriod: 'calendar_month',
        overageMode: 'paid',
        overageAddonCode: null,
        allowedRequestKinds: ['maintenance'],
      },
    });
    expect(result.engineDecision).toBe('included_uses_allowance');
  });

  it('BUSINESS actualización catálogo (overage) → paid_addon', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'paid_addon',
      reasonCode: 'recurring_allowance_exhausted_paid_overage',
      planRule: {
        availability: 'included',
        inclusionScope: 'recurring_allowance',
        initialIncludedQty: 0,
        recurringIncludedQty: 5,
        recurringPeriod: 'calendar_month',
        overageMode: 'paid',
        overageAddonCode: null,
        allowedRequestKinds: ['maintenance'],
      },
    });
    expect(result.engineDecision).toBe('paid_addon');
  });

  // ─── Upgrade routing: catalog capabilities ────────────────────────────────

  it('BASIC cat_catalog portalCategory → upgrade_required BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      portalCategory: 'cat_catalog',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('BUSINESS');
  });

  it('BASIC CA02 (recursos visuales) sin cat_catalog → upgrade_required PRO, no BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'CA02',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).not.toBe('BUSINESS');
  });

  it('BASIC cat_catalog genérico → upgrade_required BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      portalCategory: 'cat_catalog',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('BUSINESS');
  });

  it('PRO catálogo → upgrade_required BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'PRO',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      portalCategory: 'cat_catalog',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('BUSINESS');
  });

  // ─── Upgrade routing: booking/chatbot/blog → PRO ─────────────────────────

  it('BASIC booking (I02) → upgrade_required PRO', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'I02',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('PRO');
  });

  it('BASIC blog (C02A) → upgrade_required PRO', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'C02A',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('PRO');
  });

  it('PRO booking (I02) → upgrade_required BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'PRO',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'I02',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('BUSINESS');
  });

  // ─── Upgrade routing: e-commerce → LEGACY ────────────────────────────────

  it('BASIC e-commerce (EC01) → upgrade_required LEGACY', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'EC01',
      portalCategory: 'cat_ecommerce',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
  });

  it('BUSINESS e-commerce (EC03 inventario) → upgrade_required LEGACY', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'EC03',
      portalCategory: 'cat_ecommerce',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
  });

  // ─── Quote required ───────────────────────────────────────────────────────

  it('BUSINESS pagos online → quote_required', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
    });
    expect(result.engineDecision).toBe('quote_required');
  });

  it('BUSINESS e-commerce (EC01) quote → quote_required con recommendedUpgradePlan LEGACY y tier COMMERCE', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC01',
      portalCategory: 'cat_ecommerce',
    });
    expect(result.engineDecision).toBe('quote_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
    expect(result.recommendedLegacyTier).toBe('COMMERCE');
  });

  it('BUSINESS portal/login (EC05) quote → quote_required con recommendedUpgradePlan LEGACY y tier PORTAL_APP', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC05',
    });
    expect(result.engineDecision).toBe('quote_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
    expect(result.recommendedLegacyTier).toBe('PORTAL_APP');
  });

  it('LEGACY + EC01 → legacy_module con tier COMMERCE', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC01',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('COMMERCE');
  });

  it('LEGACY + EC05 → legacy_module con tier PORTAL_APP (nunca COMMERCE)', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC05',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('PORTAL_APP');
    expect(result.recommendedLegacyTier).not.toBe('COMMERCE');
  });

  it('PRO + EC01 quote → quote_required con recommendedUpgradePlan LEGACY y tier COMMERCE', () => {
    const result = resolveEngineDecision({
      plan: 'PRO',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC01',
    });
    expect(result.engineDecision).toBe('quote_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
    expect(result.recommendedLegacyTier).toBe('COMMERCE');
  });

  // ─── Legacy module ────────────────────────────────────────────────────────

  it('LEGACY catálogo → legacy_module con tier CATALOG', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'CA02',
      portalCategory: 'cat_catalog',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('CATALOG');
  });

  it('LEGACY e-commerce (EC01) → legacy_module con tier COMMERCE', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC01',
      portalCategory: 'cat_ecommerce',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('COMMERCE');
  });

  it('LEGACY portal/login clientes (EC05) → legacy_module con tier PORTAL_APP', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC05',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('PORTAL_APP');
  });

  it('LEGACY genérico → legacy_module con tier BUSINESS_CUSTOM', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('BUSINESS_CUSTOM');
  });

  // ─── Deprecated ──────────────────────────────────────────────────────────

  it('deprecated capability → deprecated', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'blocked_disabled',
      reasonCode: 'capability_disabled',
      planRule: null,
    });
    expect(result.engineDecision).toBe('deprecated');
  });

  // ─── Maintenance (Care) ───────────────────────────────────────────────────

  it('Care cambio menor → maintenance_included', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'included_allowance',
      reasonCode: 'recurring_allowance_available',
      planRule: {
        availability: 'included',
        inclusionScope: 'recurring_allowance',
        initialIncludedQty: 0,
        recurringIncludedQty: 1,
        recurringPeriod: 'calendar_month',
        overageMode: 'quote',
        overageAddonCode: null,
        allowedRequestKinds: ['maintenance'],
      },
      isMaintenance: true,
    });
    expect(result.engineDecision).toBe('maintenance_included');
  });

  it('Care nueva página → maintenance_quote_required', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      isMaintenance: true,
    });
    expect(result.engineDecision).toBe('maintenance_quote_required');
  });

  it('Care setup incluido → maintenance_included', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'included_setup',
      reasonCode: 'initial_setup',
      planRule: null,
      isMaintenance: true,
    });
    expect(result.engineDecision).toBe('maintenance_included');
  });

  // ─── New tests: C02A/C02B, WA03, WA02, EC01, EC05 ────────────────────────

  it('BASIC chatbot (WA03) → paid_addon (precio fijo, ya no upgrade-required)', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'paid_addon',
      reasonCode: 'fixed_paid',
      planRule: {
        availability: 'paid',
        inclusionScope: null,
        initialIncludedQty: 0,
        recurringIncludedQty: 0,
        recurringPeriod: null,
        overageMode: 'unavailable',
        overageAddonCode: null,
        allowedRequestKinds: ['initial_delivery'],
      },
      capabilityCode: 'WA03',
    });
    expect(result.engineDecision).toBe('paid_addon');
  });

  it('BASIC blog C02B → upgrade_required PRO', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'C02B',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('PRO');
  });

  it('BASIC catálogo WA02 → upgrade_required BUSINESS', () => {
    const result = resolveEngineDecision({
      plan: 'BASIC',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'WA02',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('BUSINESS');
  });

  it('BUSINESS EC01 → upgrade_required LEGACY', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'EC01',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
  });

  it('BUSINESS EC05 portal → upgrade_required LEGACY', () => {
    const result = resolveEngineDecision({
      plan: 'BUSINESS',
      decisionCode: 'unavailable',
      reasonCode: 'rule_unavailable',
      planRule: unavailableRule,
      capabilityCode: 'EC05',
    });
    expect(result.engineDecision).toBe('upgrade_required');
    expect(result.recommendedUpgradePlan).toBe('LEGACY');
  });

  it('LEGACY EC05 portal/login → legacy_module tier PORTAL_APP', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC05',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('PORTAL_APP');
  });

  it('LEGACY ecommerce real EC01 → legacy_module tier COMMERCE', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'EC01',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('COMMERCE');
  });

  it('LEGACY catálogo WA02 → legacy_module tier CATALOG', () => {
    const result = resolveEngineDecision({
      plan: 'LEGACY',
      decisionCode: 'quote_required',
      reasonCode: 'quote_pricing',
      planRule: quoteRule,
      capabilityCode: 'WA02',
    });
    expect(result.engineDecision).toBe('legacy_module');
    expect(result.recommendedLegacyTier).toBe('CATALOG');
  });
});
