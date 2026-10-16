// Tests for catalog-safety pure helpers.
// No DB, no auth required.

import { describe, it, expect } from 'vitest';
import {
  isCatalogPriceEditable,
  isCatalogPortalVisibilityEditable,
  getCatalogProtectionLevel,
  validateOperationalPriceChange,
  ADMIN_ONLY_PORTAL_BLOCKED_CODES,
  CORE_BASE_CODES,
  LEGACY_MAINTENANCE_CODES,
} from '@/lib/catalog/catalog-safety';

// ─── isCatalogPriceEditable ───────────────────────────────────────────────────

describe('isCatalogPriceEditable', () => {
  it('fixed non-core item D01 is editable', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'fixed' })).toBe(true);
  });

  it('fixed C01 is editable', () => {
    expect(isCatalogPriceEditable({ code: 'C01', pricingMode: 'fixed' })).toBe(true);
  });

  it('fixed LM04 is editable', () => {
    expect(isCatalogPriceEditable({ code: 'LM04', pricingMode: 'fixed' })).toBe(true);
  });

  it('included B01 (core base) is not editable', () => {
    expect(isCatalogPriceEditable({ code: 'B01', pricingMode: 'included' })).toBe(false);
  });

  it('included WA01 (core base) is not editable', () => {
    expect(isCatalogPriceEditable({ code: 'WA01', pricingMode: 'included' })).toBe(false);
  });

  it('quote EC01 (quote engine) is not editable', () => {
    expect(isCatalogPriceEditable({ code: 'EC01', pricingMode: 'quote' })).toBe(false);
  });

  it('pricingMode=included rejects regardless of code', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'included' })).toBe(false);
  });

  it('pricingMode=quote rejects regardless of code', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'quote' })).toBe(false);
  });

  it('pricingMode itself is never editable — function only gates price fields', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'fixed' })).toBe(true);
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'included' })).toBe(false);
  });

  it('planRules are readonly — not a concern of this function', () => {
    // Only pricingMode + code decide editability
    expect(isCatalogPriceEditable({ code: 'R01', pricingMode: 'fixed' })).toBe(true);
  });
});

// ─── isCatalogPortalVisibilityEditable ───────────────────────────────────────

describe('isCatalogPortalVisibilityEditable', () => {
  it('D01 is editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('D01')).toBe(true);
  });

  it('C01 is editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('C01')).toBe(true);
  });

  it('B01 (core base) is not editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('B01')).toBe(false);
  });

  it('B07 (core base) is not editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('B07')).toBe(false);
  });

  it('WA01 (core base) is not editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('WA01')).toBe(false);
  });

  it('LM01 (legacy maintenance) is not editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('LM01')).toBe(false);
  });

  it('LM05 (legacy maintenance) is not editable for portal visibility', () => {
    expect(isCatalogPortalVisibilityEditable('LM05')).toBe(false);
  });

  it('EM01 (email admin-only) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EM01')).toBe(false);
  });

  it('EM02 (email admin-only) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EM02')).toBe(false);
  });

  it('EC01 (módulo interno) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EC01')).toBe(false);
  });

  it('EC03 (módulo interno) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EC03')).toBe(false);
  });

  it('EC04 (módulo interno) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EC04')).toBe(false);
  });

  it('EC05 (módulo interno) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EC05')).toBe(false);
  });

  it('EC07 (módulo interno) is not portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('EC07')).toBe(false);
  });

  it('I04 is portal visibility editable (capacidad real del portal)', () => {
    expect(isCatalogPortalVisibilityEditable('I04')).toBe(true);
  });

  it('CM02 is portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('CM02')).toBe(true);
  });

  it('WA03 is portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('WA03')).toBe(true);
  });

  it('XI01 is portal visibility editable', () => {
    expect(isCatalogPortalVisibilityEditable('XI01')).toBe(true);
  });
});

// ─── ADMIN_ONLY_PORTAL_BLOCKED_CODES set ─────────────────────────────────────

describe('ADMIN_ONLY_PORTAL_BLOCKED_CODES', () => {
  it('contiene EM01', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EM01')).toBe(true); });
  it('contiene EM02', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EM02')).toBe(true); });
  it('contiene EC01', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EC01')).toBe(true); });
  it('contiene EC03', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EC03')).toBe(true); });
  it('contiene EC04', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EC04')).toBe(true); });
  it('contiene EC05', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EC05')).toBe(true); });
  it('contiene EC07', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('EC07')).toBe(true); });
  it('no contiene I04 (editable)', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('I04')).toBe(false); });
  it('no contiene CM02 (editable)', () => { expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has('CM02')).toBe(false); });
});

// ─── Todos los grupos de bloqueo conjuntos ────────────────────────────────────

describe('isCatalogPortalVisibilityEditable: cobertura completa de sets bloqueados', () => {
  it('todos los CORE_BASE_CODES retornan false', () => {
    for (const code of CORE_BASE_CODES) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });

  it('todos los LEGACY_MAINTENANCE_CODES retornan false', () => {
    for (const code of LEGACY_MAINTENANCE_CODES) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });

  it('todos los ADMIN_ONLY_PORTAL_BLOCKED_CODES retornan false', () => {
    for (const code of ADMIN_ONLY_PORTAL_BLOCKED_CODES) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });
});

// ─── getCatalogProtectionLevel ────────────────────────────────────────────────

describe('getCatalogProtectionLevel', () => {
  it('waas_ticket source is canonical', () => {
    expect(getCatalogProtectionLevel('waas_ticket')).toBe('canonical');
  });

  it('legacy_calculator source is canonical', () => {
    expect(getCatalogProtectionLevel('legacy_calculator')).toBe('canonical');
  });

  it('manual source is manual', () => {
    expect(getCatalogProtectionLevel('manual')).toBe('manual');
  });

  it('unknown source defaults to canonical', () => {
    expect(getCatalogProtectionLevel('unknown_source')).toBe('canonical');
  });
});

// ─── validateOperationalPriceChange ──────────────────────────────────────────

describe('validateOperationalPriceChange', () => {
  it('rejects negative priceCents', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: -100 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects priceCents=0 for fixed item', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 0 },
    );
    expect(err).not.toBeNull();
  });

  it('accepts valid priceCents > 0 for fixed item', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 2900 },
    );
    expect(err).toBeNull();
  });

  it('rejects price change for included item (any code)', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'included' },
      { priceCents: 2900 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects price change for quote EC01', () => {
    const err = validateOperationalPriceChange(
      { code: 'EC01', pricingMode: 'quote' },
      { priceCents: 5000 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects price change for core base B01', () => {
    const err = validateOperationalPriceChange(
      { code: 'B01', pricingMode: 'included' },
      { priceCents: 0 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects listPriceCents < priceCents', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 5000, listPriceCents: 3000 },
    );
    expect(err).not.toBeNull();
  });

  it('accepts listPriceCents === priceCents', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 5000, listPriceCents: 5000 },
    );
    expect(err).toBeNull();
  });

  it('accepts listPriceCents > priceCents', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 5000, listPriceCents: 6000 },
    );
    expect(err).toBeNull();
  });

  it('accepts only listPriceCents update without priceCents', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { listPriceCents: 9900 },
    );
    expect(err).toBeNull();
  });

  it('dependencies and conflicts are readonly — not validated here', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 2900 },
    );
    expect(err).toBeNull();
  });

  it('rejects quote item even if only listPriceCents is attempted', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'quote' },
      { listPriceCents: 9900 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects included item even if only listPriceCents is attempted', () => {
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'included' },
      { listPriceCents: 9900 },
    );
    expect(err).not.toBeNull();
  });

  it('rejects when effective listPriceCents is below effective priceCents', () => {
    // Simulates action passing effective values: priceCents from DB, listPriceCents from input
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 5000, listPriceCents: 4000 },
    );
    expect(err).not.toBeNull();
  });

  it('accepts when effective listPriceCents is above effective priceCents', () => {
    // Simulates action passing effective values: priceCents from DB, listPriceCents from input
    const err = validateOperationalPriceChange(
      { code: 'D01', pricingMode: 'fixed' },
      { priceCents: 5000, listPriceCents: 6000 },
    );
    expect(err).toBeNull();
  });

  it('accepts listPriceCents=0 (DB default sentinel for no-list-price) even when priceCents > 0', () => {
    // 13 items in DB have list_price_cents=0 with price_cents>0 (e.g. I04, R01, C01).
    // 0 means "no list price set" — must not fail when admin saves without changing list price.
    const err = validateOperationalPriceChange(
      { code: 'I04', pricingMode: 'fixed' },
      { priceCents: 9900, listPriceCents: 0 },
    );
    expect(err).toBeNull();
  });

  it('accepts listPriceCents=0 as sentinel for R01 fixed price save', () => {
    const err = validateOperationalPriceChange(
      { code: 'R01', pricingMode: 'fixed' },
      { priceCents: 2500, listPriceCents: 0 },
    );
    expect(err).toBeNull();
  });
});
