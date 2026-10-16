import { describe, expect, it } from 'vitest';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import { isReactivationCapabilityVisible } from '@/lib/catalog/types';
import type {
  CatalogCapability,
  CatalogPlanRule,
  CatalogRequestInput,
  ProjectCatalogContext,
} from '@/lib/catalog/types';

const baseCapability: CatalogCapability = {
  id: 'cap-d01',
  code: 'D01',
  active: true,
  pricingMode: 'fixed',
  listPriceCents: 5900,
  priceCents: 5900,
  dependencies: [],
  conflicts: [],
};

const baseRule: CatalogPlanRule = {
  availability: 'paid',
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'paid',
  overageAddonCode: null,
  allowedRequestKinds: ['change'],
};

const baseProject: ProjectCatalogContext = {
  id: 'project-1',
  plan: 'PRO',
  status: 'LIVE',
  postLaunchWarrantyEndsAt: null,
};

function makeInput(overrides: Partial<CatalogRequestInput> = {}): CatalogRequestInput {
  return {
    capability: baseCapability,
    planRule: baseRule,
    project: baseProject,
    requestKind: 'change',
    quantity: 1,
    now: new Date('2026-05-05T12:00:00Z'),
    usageHistory: [],
    deliveredCapabilityCodes: [],
    availableCapabilityCodes: ['D01', 'D02', 'B01'],
    ...overrides,
  };
}

function includedRule(overrides: Partial<CatalogPlanRule> = {}): CatalogPlanRule {
  return {
    ...baseRule,
    availability: 'included',
    inclusionScope: 'initial_setup',
    initialIncludedQty: 1,
    overageMode: 'unavailable',
    allowedRequestKinds: ['initial_delivery'],
    ...overrides,
  };
}

describe('resolveCatalogRequest', () => {
  it('blocks request kinds that are not allowed by the plan rule', () => {
    const decision = resolveCatalogRequest(makeInput({
      planRule: { ...baseRule, allowedRequestKinds: ['initial_delivery'] },
      requestKind: 'change',
    }));

    expect(decision.decision).toBe('blocked_request_kind');
    expect(decision.nextAction).toBe('blocked');
  });

  it('includes corrections during the post-launch warranty without consuming allowance', () => {
    const decision = resolveCatalogRequest(makeInput({
      requestKind: 'correction',
      project: {
        ...baseProject,
        postLaunchWarrantyEndsAt: new Date('2026-05-06T12:00:00Z'),
      },
      planRule: { ...baseRule, allowedRequestKinds: ['correction'] },
    }));

    expect(decision.decision).toBe('included_warranty');
    expect(decision.includedQuantity).toBe(1);
    expect(decision.totalPriceCents).toBe(0);
  });

  it('treats corrections outside warranty as changes', () => {
    const decision = resolveCatalogRequest(makeInput({
      requestKind: 'correction',
      project: {
        ...baseProject,
        postLaunchWarrantyEndsAt: new Date('2026-05-04T12:00:00Z'),
      },
      planRule: { ...baseRule, allowedRequestKinds: ['change'] },
    }));

    expect(decision.normalizedRequestKind).toBe('change');
    expect(decision.decision).toBe('paid_addon');
  });

  it('includes pending initial setup when it has not been delivered', () => {
    const decision = resolveCatalogRequest(makeInput({
      requestKind: 'initial_delivery',
      planRule: includedRule(),
    }));

    expect(decision.decision).toBe('included_setup');
    expect(decision.includedQuantity).toBe(1);
    expect(decision.totalPriceCents).toBe(0);
  });

  it('blocks duplicate setup when the capability was already delivered', () => {
    const decision = resolveCatalogRequest(makeInput({
      requestKind: 'initial_delivery',
      planRule: includedRule(),
      deliveredCapabilityCodes: ['D01'],
    }));

    expect(decision.decision).toBe('blocked_duplicate');
    expect(decision.nextAction).toBe('blocked');
  });

  it('uses available recurring allowance before charging', () => {
    const decision = resolveCatalogRequest(makeInput({
      quantity: 2,
      planRule: includedRule({
        inclusionScope: 'recurring_allowance',
        recurringIncludedQty: 3,
        recurringPeriod: 'calendar_month',
        allowedRequestKinds: ['change'],
      }),
      usageHistory: [{ quantity: 1, decision: 'included_allowance', occurredAt: new Date('2026-05-02T12:00:00Z') }],
    }));

    expect(decision.decision).toBe('included_allowance');
    expect(decision.includedQuantity).toBe(2);
    expect(decision.totalPriceCents).toBe(0);
  });

  it('charges paid overage when allowance is exhausted', () => {
    const decision = resolveCatalogRequest(makeInput({
      quantity: 2,
      planRule: includedRule({
        inclusionScope: 'recurring_allowance',
        recurringIncludedQty: 1,
        recurringPeriod: 'calendar_month',
        overageMode: 'paid',
        allowedRequestKinds: ['change'],
      }),
      usageHistory: [{ quantity: 1, decision: 'included_allowance', occurredAt: new Date('2026-05-02T12:00:00Z') }],
    }));

    expect(decision.decision).toBe('paid_addon');
    expect(decision.includedQuantity).toBe(0);
    expect(decision.paidQuantity).toBe(2);
    expect(decision.totalPriceCents).toBe(11800);
  });

  it('splits included and quote quantities when overage requires quote', () => {
    const decision = resolveCatalogRequest(makeInput({
      quantity: 3,
      planRule: includedRule({
        inclusionScope: 'recurring_allowance',
        recurringIncludedQty: 2,
        recurringPeriod: 'calendar_month',
        overageMode: 'quote',
        allowedRequestKinds: ['change'],
      }),
    }));

    expect(decision.decision).toBe('partial_available');
    expect(decision.includedQuantity).toBe(2);
    expect(decision.quoteQuantity).toBe(1);
    expect(decision.nextAction).toBe('show_partial_options');
  });

  it('shows partial options when unavailable overage exceeds allowance', () => {
    const decision = resolveCatalogRequest(makeInput({
      quantity: 3,
      planRule: includedRule({
        inclusionScope: 'recurring_allowance',
        recurringIncludedQty: 1,
        recurringPeriod: 'calendar_month',
        overageMode: 'unavailable',
        allowedRequestKinds: ['change'],
      }),
    }));

    expect(decision.decision).toBe('partial_available');
    expect(decision.includedQuantity).toBe(1);
    expect(decision.unavailableQuantity).toBe(2);
    expect(decision.nextAction).toBe('show_partial_options');
  });

  it('does not assume included when an included capability has no applicable rule', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: { ...baseCapability, pricingMode: 'included', priceCents: 0 },
      planRule: null,
    }));

    expect(decision.decision).toBe('unavailable');
    expect(decision.totalPriceCents).toBe(null);
  });

  it('blocks disabled capabilities', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: { ...baseCapability, active: false },
    }));

    expect(decision.decision).toBe('blocked_disabled');
  });

  it('supports maintenance as a commercial request kind from the approved matrix', () => {
    const decision = resolveCatalogRequest(makeInput({
      requestKind: 'maintenance',
      planRule: { ...baseRule, allowedRequestKinds: ['maintenance'] },
    }));

    expect(decision.decision).toBe('paid_addon');
  });

  it('blocks when a dependency is missing', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: { ...baseCapability, dependencies: ['B99'] },
    }));

    expect(decision.decision).toBe('blocked_missing_dependency');
  });

  it('blocks commercial requests for CLOSED projects', () => {
    const decision = resolveCatalogRequest(makeInput({
      project: { ...baseProject, status: 'CLOSED' },
    }));

    expect(decision.decision).toBe('blocked_project_closed');
  });

  it('handles a mid-month downgrade when the included remaining quantity is zero', () => {
    const decision = resolveCatalogRequest(makeInput({
      quantity: 1,
      planRule: includedRule({
        inclusionScope: 'recurring_allowance',
        recurringIncludedQty: 1,
        recurringPeriod: 'calendar_month',
        overageMode: 'unavailable',
        allowedRequestKinds: ['change'],
      }),
      usageHistory: [{ quantity: 1, decision: 'included_allowance', occurredAt: new Date('2026-05-01T12:00:00Z') }],
    }));

    expect(decision.includedRemaining).toBe(0);
    expect(decision.decision).toBe('unavailable');
  });

  it('ignores null or orphan conflict data without throwing', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: { ...baseCapability, conflicts: [null, 'Z99'] },
    }));

    expect(decision.decision).toBe('paid_addon');
  });

  it('never calculates a fixed price for quote capabilities', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: { ...baseCapability, pricingMode: 'quote', priceCents: null },
      planRule: { ...baseRule, availability: 'quote' },
    }));

    expect(decision.decision).toBe('quote_required');
    expect(decision.totalPriceCents).toBe(null);
  });

  // ─── R01 reactivation rules ───────────────────────────────────────────────

  const r01Capability: CatalogCapability = {
    id: 'cap-r01',
    code: 'R01',
    active: true,
    pricingMode: 'fixed',
    listPriceCents: 2500,
    priceCents: 2500,
    dependencies: [],
    conflicts: [],
  };

  const r01Rule: CatalogPlanRule = {
    ...baseRule,
    availability: 'paid',
    allowedRequestKinds: ['reactivation'],
  };

  it('blocks R01 on LIVE projects (r01_requires_suspended_project)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      project: { ...baseProject, status: 'LIVE' },
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_requires_suspended_project');
  });

  it('blocks R01 on SUSPENDED projects before day 11 of suspension', () => {
    const DAY = 86_400_000;
    const now = new Date('2026-05-29T12:00:00Z');
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      project: {
        ...baseProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(now.getTime() - 10 * DAY),
        reactivationFeeActive: false,
      },
      now,
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });

  it('allows R01 as paid_addon on SUSPENDED projects at day 11 of suspension', () => {
    const DAY = 86_400_000;
    const now = new Date('2026-05-29T12:00:00Z');
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(now.getTime() - 11 * DAY),
        reactivationFeeActive: false,
      },
      now,
    }));
    expect(decision.decision).toBe('paid_addon');
    expect(decision.reasonCode).toBe('fixed_paid');
  });

  it('allows R01 immediately when reactivationFeeActive override is set', () => {
    const now = new Date('2026-05-29T12:00:00Z');
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(now.getTime() - 1 * 86_400_000),
        reactivationFeeActive: true,
      },
      now,
    }));
    expect(decision.decision).toBe('paid_addon');
  });

  it('blocks non-R01 capabilities on SUSPENDED projects', () => {
    const decision = resolveCatalogRequest(makeInput({
      project: { ...baseProject, status: 'SUSPENDED', suspendedAt: null },
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('suspended_commercial_blocked');
  });
});

describe('isReactivationCapabilityVisible', () => {
  const DAY = 86_400_000;
  const now = new Date('2026-05-29T12:00:00Z');

  it('returns false when project is not SUSPENDED', () => {
    expect(
      isReactivationCapabilityVisible({ status: 'LIVE', suspendedAt: null, reactivationFeeActive: false }, now)
    ).toBe(false);
  });

  it('returns false when SUSPENDED but suspendedAt is null', () => {
    expect(
      isReactivationCapabilityVisible({ status: 'SUSPENDED', suspendedAt: null, reactivationFeeActive: false }, now)
    ).toBe(false);
  });

  it('returns true when reactivationFeeActive override is set regardless of days', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(now.getTime() - 1 * DAY), reactivationFeeActive: true },
        now
      )
    ).toBe(true);
  });

  it('returns false on day 10 of suspension', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(now.getTime() - 10 * DAY), reactivationFeeActive: false },
        now
      )
    ).toBe(false);
  });

  it('returns true on day 11 of suspension', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(now.getTime() - 11 * DAY), reactivationFeeActive: false },
        now
      )
    ).toBe(true);
  });
});
