// Tests for admin catalog validation logic
// Pure functions — no DB, no auth required.

import { describe, it, expect } from 'vitest';
import {
  validatePlanRule,
  validateCatalogItemUpdate,
  validateCatalogDependencyGraph,
} from '@/lib/catalog/admin-validations';

// ─── validatePlanRule ─────────────────────────────────────────────────────────

describe('validatePlanRule: allowedRequestKinds', () => {
  it('returns error when allowedRequestKinds is empty', () => {
    const err = validatePlanRule({
      availability: 'paid',
      inclusionScope: null,
      initialIncludedQty: 0,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: [],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/al menos un tipo/i);
  });

  it('returns error when allowedRequestKinds contains invalid value', () => {
    const err = validatePlanRule({
      availability: 'paid',
      inclusionScope: null,
      initialIncludedQty: 0,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: ['change', 'invalid_kind'],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/inválido/i);
    expect(err).toContain('invalid_kind');
  });

  it('accepts valid allowedRequestKinds for paid availability', () => {
    const err = validatePlanRule({
      availability: 'paid',
      inclusionScope: null,
      initialIncludedQty: 0,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: ['change', 'maintenance'],
    });
    expect(err).toBeNull();
  });
});

describe('validatePlanRule: included availability invariants', () => {
  it('returns error when included has no inclusionScope', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: null,
      initialIncludedQty: 1,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: ['initial_delivery'],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/alcance/i);
  });

  it('returns error when initial_setup has initialIncludedQty <= 0', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: 'initial_setup',
      initialIncludedQty: 0,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: ['initial_delivery'],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/cupo inicial/i);
  });

  it('accepts valid initial_setup with qty > 0', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: 'initial_setup',
      initialIncludedQty: 1,
      recurringIncludedQty: 0,
      recurringPeriod: null,
      allowedRequestKinds: ['initial_delivery', 'change'],
    });
    expect(err).toBeNull();
  });

  it('returns error when recurring_allowance has recurringIncludedQty <= 0', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: 'recurring_allowance',
      initialIncludedQty: 0,
      recurringIncludedQty: 0,
      recurringPeriod: 'calendar_month',
      allowedRequestKinds: ['change'],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/cupo recurrente/i);
  });

  it('returns error when recurring_allowance has no recurringPeriod', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: 'recurring_allowance',
      initialIncludedQty: 0,
      recurringIncludedQty: 2,
      recurringPeriod: null,
      allowedRequestKinds: ['change'],
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/período/i);
  });

  it('accepts valid recurring_allowance', () => {
    const err = validatePlanRule({
      availability: 'included',
      inclusionScope: 'recurring_allowance',
      initialIncludedQty: 0,
      recurringIncludedQty: 2,
      recurringPeriod: 'calendar_month',
      allowedRequestKinds: ['change', 'expansion'],
    });
    expect(err).toBeNull();
  });

  it('accepts quote and unavailable without scope', () => {
    for (const availability of ['quote', 'unavailable'] as const) {
      const err = validatePlanRule({
        availability,
        inclusionScope: null,
        initialIncludedQty: 0,
        recurringIncludedQty: 0,
        recurringPeriod: null,
        allowedRequestKinds: ['change'],
      });
      expect(err).toBeNull();
    }
  });
});

// ─── validateCatalogItemUpdate ────────────────────────────────────────────────

const baseCtx = {
  code: 'D01',
  effectivePortalCategoryId: 'cat-design',
  portalCategoryActive: true,
  rules: [],
};

describe('validateCatalogItemUpdate: pricingMode=fixed', () => {
  it('returns error when fixed mode has priceCents = 0', () => {
    const err = validateCatalogItemUpdate({ pricingMode: 'fixed', priceCents: 0 }, baseCtx);
    expect(err).not.toBeNull();
    expect(err).toMatch(/fijo/i);
  });

  it('returns error when fixed mode has priceCents < 0', () => {
    const err = validateCatalogItemUpdate({ pricingMode: 'fixed', priceCents: -100 }, baseCtx);
    expect(err).not.toBeNull();
  });

  it('accepts fixed mode with priceCents > 0', () => {
    const err = validateCatalogItemUpdate({ pricingMode: 'fixed', priceCents: 2900 }, baseCtx);
    expect(err).toBeNull();
  });

  it('does not validate price when pricingMode is not fixed', () => {
    // Para included, hay que proveer una regla válida para que no falle por la validación de included
    const includedCtx = {
      ...baseCtx,
      rules: [
        {
          availability: 'included' as const,
          inclusionScope: 'initial_setup' as const,
          initialIncludedQty: 1,
          recurringIncludedQty: 0,
          recurringPeriod: null,
          allowedRequestKinds: ['initial_delivery'] as string[],
        },
      ],
    };
    const err = validateCatalogItemUpdate({ pricingMode: 'included', priceCents: 0 }, includedCtx);
    expect(err).toBeNull();
  });
});

describe('validateCatalogItemUpdate: pricingMode=included', () => {
  it('returns error when included has no valid rules', () => {
    const err = validateCatalogItemUpdate({ pricingMode: 'included' }, baseCtx);
    expect(err).not.toBeNull();
    expect(err).toMatch(/cupo válido/i);
  });

  it('accepts included mode with valid initial_setup rule', () => {
    const validCtx = {
      ...baseCtx,
      rules: [
        {
          availability: 'included' as const,
          inclusionScope: 'initial_setup' as const,
          initialIncludedQty: 1,
          recurringIncludedQty: 0,
          recurringPeriod: null,
          allowedRequestKinds: ['initial_delivery'] as string[],
        },
      ],
    };
    const err = validateCatalogItemUpdate({ pricingMode: 'included' }, validCtx);
    expect(err).toBeNull();
  });

  it('accepts included mode with valid recurring_allowance rule', () => {
    const validCtx = {
      ...baseCtx,
      rules: [
        {
          availability: 'included' as const,
          inclusionScope: 'recurring_allowance' as const,
          initialIncludedQty: 0,
          recurringIncludedQty: 1,
          recurringPeriod: 'calendar_month' as const,
          allowedRequestKinds: ['maintenance'] as string[],
        },
      ],
    };
    const err = validateCatalogItemUpdate({ pricingMode: 'included' }, validCtx);
    expect(err).toBeNull();
  });
});

describe('validateCatalogItemUpdate: visibleInPortal invariants', () => {
  it('returns error when visibleInPortal=true but no portal category', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { ...baseCtx, effectivePortalCategoryId: null, portalCategoryActive: null },
    );
    expect(err).not.toBeNull();
    expect(err).toMatch(/categoría/i);
  });

  it('returns error when portal category is inactive', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { ...baseCtx, effectivePortalCategoryId: 'cat-x', portalCategoryActive: false },
    );
    expect(err).not.toBeNull();
    expect(err).toMatch(/activa/i);
  });

  it('accepts visibleInPortal=true with active category', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { ...baseCtx, effectivePortalCategoryId: 'cat-design', portalCategoryActive: true },
    );
    expect(err).toBeNull();
  });

  it('does not validate category when visibleInPortal is not being set to true', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: false },
      { ...baseCtx, effectivePortalCategoryId: null, portalCategoryActive: null },
    );
    expect(err).toBeNull();
  });
});

describe('validateCatalogItemUpdate: self-reference guard', () => {
  it('returns error when dependencies contain own code', () => {
    const err = validateCatalogItemUpdate(
      { dependencies: ['C01', 'D01'] },
      { ...baseCtx, code: 'D01' },
    );
    expect(err).not.toBeNull();
    expect(err).toMatch(/D01/);
  });

  it('accepts dependencies that do not include own code', () => {
    const err = validateCatalogItemUpdate(
      { dependencies: ['C01', 'I01'] },
      { ...baseCtx, code: 'D01' },
    );
    expect(err).toBeNull();
  });

  it('returns error when conflicts contain own code', () => {
    const err = validateCatalogItemUpdate(
      { conflicts: ['D01'] },
      { ...baseCtx, code: 'D01' },
    );
    expect(err).not.toBeNull();
    expect(err).toMatch(/D01/);
  });

  it('accepts conflicts that do not include own code', () => {
    const err = validateCatalogItemUpdate(
      { conflicts: ['C01', null] },
      { ...baseCtx, code: 'D01' },
    );
    expect(err).toBeNull();
  });

  it('handles null entries in conflicts array without error', () => {
    const err = validateCatalogItemUpdate(
      { conflicts: [null, null] },
      { ...baseCtx, code: 'D01' },
    );
    expect(err).toBeNull();
  });
});

describe('validateCatalogItemUpdate: combined validations', () => {
  it('catches the first error (price) when multiple violations present', () => {
    const err = validateCatalogItemUpdate(
      { pricingMode: 'fixed', priceCents: 0, visibleInPortal: true },
      { code: 'D01', effectivePortalCategoryId: null, portalCategoryActive: null, rules: [] },
    );
    // Should return the first encountered error (priceCents check runs before portal check)
    expect(err).not.toBeNull();
  });

  it('returns null when no fields being validated have issues', () => {
    const err = validateCatalogItemUpdate(
      {},
      baseCtx,
    );
    expect(err).toBeNull();
  });
});

// ─── validateCatalogDependencyGraph ───────────────────────────────────────────

describe('validateCatalogDependencyGraph', () => {
  const knownItems = [
    { code: 'A', dependencies: [] },
    { code: 'B', dependencies: ['A'] },
    { code: 'C', dependencies: ['B'] },
  ];

  it('returns error for nonexistent dependency', () => {
    const err = validateCatalogDependencyGraph({
      currentCode: 'A',
      nextDependencies: ['Z'],
      knownItems,
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/inexistente/i);
  });

  it('returns error for direct self-reference (cycle A -> A)', () => {
    const err = validateCatalogDependencyGraph({
      currentCode: 'A',
      nextDependencies: ['A'],
      knownItems,
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/sí mismo/i);
  });

  it('returns error for transitive cycle (A -> B -> C -> A)', () => {
    const err = validateCatalogDependencyGraph({
      currentCode: 'A',
      nextDependencies: ['C'], // A depends on C, C depends on B, B depends on A
      knownItems,
    });
    expect(err).not.toBeNull();
    expect(err).toMatch(/circular/i);
  });

  it('accepts valid graph without cycles', () => {
    const err = validateCatalogDependencyGraph({
      currentCode: 'C',
      nextDependencies: ['B', 'A'],
      knownItems,
    });
    expect(err).toBeNull();
  });
});
