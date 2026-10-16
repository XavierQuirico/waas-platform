// Catálogo comercial (admin) — pruebas de contrato
// Validates admin catalog invariants against the catalog-defaults.json seed
// and catalog-safety/admin-validations pure helpers.
// No DB, no auth required.

import { describe, it, expect } from 'vitest';
import catalogDefaults from '@/db/seeds/catalog-defaults.json';
import {
  isCatalogPriceEditable,
  isCatalogPortalVisibilityEditable,
  validateOperationalPriceChange,
  CORE_BASE_CODES,
  QUOTE_ENGINE_CODES,
  LEGACY_MAINTENANCE_CODES,
  ADMIN_ONLY_PORTAL_BLOCKED_CODES,
} from '@/lib/catalog/catalog-safety';
import { validateCatalogItemUpdate } from '@/lib/catalog/admin-validations';

const caps = catalogDefaults.capabilities as Array<Record<string, unknown>>;
const cats = catalogDefaults.portalCategories as Array<Record<string, unknown>>;

// ─── A. Counts & catalog integrity ───────────────────────────────────────────

describe('Admin catalog QA: counts', () => {
  it('catalogo tiene exactamente 47 capacidades', () => {
    expect(caps).toHaveLength(47);
  });

  it('todas las 47 capacidades son activas (active=true o no tienen active=false)', () => {
    const inactive = caps.filter((c) => c.active === false);
    expect(inactive).toHaveLength(0);
  });

  it('existen 7 categorías de portal', () => {
    expect(cats).toHaveLength(7);
  });

  it('6 categorías de portal están activas', () => {
    const active = cats.filter((c) => c.active !== false);
    expect(active).toHaveLength(6);
  });

  it('cat_ecommerce existe como categoría inactiva (módulos internos)', () => {
    const ecommercecat = cats.find((c) => c.id === 'cat_ecommerce');
    expect(ecommercecat).toBeDefined();
    expect(ecommercecat!.active).toBe(false);
  });

  it('27 capacidades son visibles en portal', () => {
    const portalVisible = caps.filter((c) => c.visibleInPortal === true);
    expect(portalVisible).toHaveLength(27);
  });
});

// ─── B. Obsolete codes absent ─────────────────────────────────────────────────

describe('Admin catalog QA: códigos obsoletos ausentes', () => {
  const obsolete = [
    'D04', 'XI02', 'XI05', 'XI06', 'XI07', 'XI08', 'XI09',
    'CM01', 'EM03', 'EM04', 'CE03', 'EC02', 'EC06', 'EC08',
  ];
  const presentCodes = new Set(caps.map((c) => c.code as string));

  for (const code of obsolete) {
    it(`código obsoleto ${code} no existe en el catálogo`, () => {
      expect(presentCodes.has(code)).toBe(false);
    });
  }
});

// ─── C. I04 ───────────────────────────────────────────────────────────────────

describe('Admin catalog QA: I04 Carga asistida de catálogo', () => {
  const i04 = caps.find((c) => c.code === 'I04') as {
    priceCents: number;
    pricingMode: string;
    portalCategory: string;
    visibleInPortal: boolean;
    planRules: Record<string, { availability: string }>;
  } | undefined;

  it('I04 existe', () => { expect(i04).toBeDefined(); });
  it('I04 precio $99 (9900 centavos)', () => { expect(i04!.priceCents).toBe(9900); });
  it('I04 pricingMode fixed', () => { expect(i04!.pricingMode).toBe('fixed'); });
  it('I04 categoría cat_catalog', () => { expect(i04!.portalCategory).toBe('cat_catalog'); });
  it('I04 visible en portal', () => { expect(i04!.visibleInPortal).toBe(true); });
  it('I04 BASIC unavailable', () => { expect(i04!.planRules['BASIC'].availability).toBe('unavailable'); });
  it('I04 PRO unavailable', () => { expect(i04!.planRules['PRO'].availability).toBe('unavailable'); });
  it('I04 BUSINESS paid', () => { expect(i04!.planRules['BUSINESS'].availability).toBe('paid'); });
  it('I04 LEGACY quote', () => { expect(i04!.planRules['LEGACY'].availability).toBe('quote'); });
});

// ─── D. EM01/EM02 admin-only ──────────────────────────────────────────────────

describe('Admin catalog QA: EM01/EM02 email corporativo', () => {
  for (const code of ['EM01', 'EM02']) {
    it(`${code} no es visible en portal (admin-only)`, () => {
      const cap = caps.find((c) => c.code === code);
      expect(cap).toBeDefined();
      expect((cap as { visibleInPortal: boolean }).visibleInPortal).toBe(false);
    });
  }

  it('EM01 precio $49', () => {
    const em01 = caps.find((c) => c.code === 'EM01') as { priceCents: number } | undefined;
    expect(em01!.priceCents).toBe(4900);
  });

  it('EM02 precio $89', () => {
    const em02 = caps.find((c) => c.code === 'EM02') as { priceCents: number } | undefined;
    expect(em02!.priceCents).toBe(8900);
  });

  for (const code of ['EM01', 'EM02']) {
    it(`${code} portal visibility no editable desde admin (bloqueada en safety)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });

    it(`${code} está en ADMIN_ONLY_PORTAL_BLOCKED_CODES`, () => {
      expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has(code)).toBe(true);
    });
  }

  it('EM03 no existe', () => {
    expect(caps.find((c) => c.code === 'EM03')).toBeUndefined();
  });

  it('EM04 no existe', () => {
    expect(caps.find((c) => c.code === 'EM04')).toBeUndefined();
  });
});

// ─── E. LM01-LM05 admin-only ─────────────────────────────────────────────────

describe('Admin catalog QA: LM01-LM05 mantenimiento LEGACY', () => {
  const lmCodes = ['LM01', 'LM02', 'LM03', 'LM04', 'LM05'];

  for (const code of lmCodes) {
    it(`${code} no es visible en portal (admin-only)`, () => {
      const cap = caps.find((c) => c.code === code);
      expect(cap).toBeDefined();
      expect((cap as { visibleInPortal: boolean }).visibleInPortal).toBe(false);
    });

    it(`${code} portal visibility no editable desde admin (bloqueada en safety)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });
  }

  it('LM01 Care $49/mes (4900)', () => {
    const lm01 = caps.find((c) => c.code === 'LM01') as { priceCents: number } | undefined;
    expect(lm01!.priceCents).toBe(4900);
  });

  it('LM02 Care Plus $89/mes (8900)', () => {
    const lm02 = caps.find((c) => c.code === 'LM02') as { priceCents: number } | undefined;
    expect(lm02!.priceCents).toBe(8900);
  });

  it('LM03 Care Pro $149/mes (14900)', () => {
    const lm03 = caps.find((c) => c.code === 'LM03') as { priceCents: number } | undefined;
    expect(lm03!.priceCents).toBe(14900);
  });

  it('LM04 Hosting básico $20/mes (2000)', () => {
    const lm04 = caps.find((c) => c.code === 'LM04') as { priceCents: number } | undefined;
    expect(lm04!.priceCents).toBe(2000);
  });

  it('LM05 es quote (hosting personalizado)', () => {
    const lm05 = caps.find((c) => c.code === 'LM05') as { pricingMode: string } | undefined;
    expect(lm05!.pricingMode).toBe('quote');
  });

  it('LM codes están en LEGACY_MAINTENANCE_CODES', () => {
    for (const code of lmCodes) {
      expect(LEGACY_MAINTENANCE_CODES.has(code)).toBe(true);
    }
  });
});

// ─── F. EC01/EC03/EC04/EC05/EC07 módulos internos ────────────────────────────

describe('Admin catalog QA: EC01/EC03/EC04/EC05/EC07 e-commerce Legacy', () => {
  const ecActive = ['EC01', 'EC03', 'EC04', 'EC05', 'EC07'];

  for (const code of ecActive) {
    it(`${code} no es visible en portal`, () => {
      const cap = caps.find((c) => c.code === code) as { visibleInPortal: boolean } | undefined;
      expect(cap).toBeDefined();
      expect(cap!.visibleInPortal).toBe(false);
    });

    it(`${code} no es visible en tickets (cliente no lo ve)`, () => {
      const cap = caps.find((c) => c.code === code) as { visibleInTickets: boolean } | undefined;
      expect(cap!.visibleInTickets).toBe(false);
    });

    it(`${code} está en QUOTE_ENGINE_CODES (precio no editable desde admin)`, () => {
      expect(QUOTE_ENGINE_CODES.has(code)).toBe(true);
    });

    it(`${code} portal visibility no editable desde admin (admin-only/internal)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });

    it(`${code} está en ADMIN_ONLY_PORTAL_BLOCKED_CODES`, () => {
      expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has(code)).toBe(true);
    });
  }

  it('EC02 no existe (retirado)', () => {
    expect(caps.find((c) => c.code === 'EC02')).toBeUndefined();
  });

  it('EC06 no existe (retirado)', () => {
    expect(caps.find((c) => c.code === 'EC06')).toBeUndefined();
  });

  it('EC08 no existe (retirado)', () => {
    expect(caps.find((c) => c.code === 'EC08')).toBeUndefined();
  });
});

// ─── G. R01 reactivación ──────────────────────────────────────────────────────

describe('Admin catalog QA: R01 reactivación', () => {
  const r01 = caps.find((c) => c.code === 'R01') as {
    priceCents: number;
    pricingMode: string;
    visibleInPortal: boolean;
    publicDescription: string;
    planRules: Record<string, { availability: string }>;
  } | undefined;

  it('R01 existe', () => { expect(r01).toBeDefined(); });
  it('R01 precio $25 (2500 centavos)', () => { expect(r01!.priceCents).toBe(2500); });
  it('R01 pricingMode fixed', () => { expect(r01!.pricingMode).toBe('fixed'); });
  it('R01 visible en portal (condicional por regla de suspensión)', () => { expect(r01!.visibleInPortal).toBe(true); });
  it('R01 publicDescription no contiene precio hardcodeado', () => {
    expect(r01!.publicDescription).not.toContain('$25');
    expect(r01!.publicDescription).not.toContain('25 USD');
  });
  it('R01 es precio editable desde admin (fixed, no core-base, no quote-engine)', () => {
    expect(isCatalogPriceEditable({ code: 'R01', pricingMode: 'fixed' })).toBe(true);
  });
});

// ─── H. Precios protegidos vs editables ──────────────────────────────────────

describe('Admin catalog QA: protección de precios', () => {
  it('capacidades CORE_BASE no son editables (B01-B07, WA01)', () => {
    for (const code of CORE_BASE_CODES) {
      expect(isCatalogPriceEditable({ code, pricingMode: 'included' })).toBe(false);
    }
  });

  it('EC codes (QUOTE_ENGINE) no son editables como precio fijo', () => {
    for (const code of QUOTE_ENGINE_CODES) {
      expect(isCatalogPriceEditable({ code, pricingMode: 'quote' })).toBe(false);
    }
  });

  it('pricingMode=quote bloquea edición de precio independientemente del código', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'quote' })).toBe(false);
  });

  it('pricingMode=included bloquea edición de precio independientemente del código', () => {
    expect(isCatalogPriceEditable({ code: 'D01', pricingMode: 'included' })).toBe(false);
  });

  it('validación server-side bloquea precio=0 para ítem fixed editable', () => {
    const err = validateOperationalPriceChange(
      { code: 'I04', pricingMode: 'fixed' },
      { priceCents: 0 },
    );
    expect(err).not.toBeNull();
  });

  it('validación server-side permite precio válido para I04', () => {
    const err = validateOperationalPriceChange(
      { code: 'I04', pricingMode: 'fixed' },
      { priceCents: 9900 },
    );
    expect(err).toBeNull();
  });

  it('validación server-side permite I04 con listPriceCents=0 (sentinel)', () => {
    const err = validateOperationalPriceChange(
      { code: 'I04', pricingMode: 'fixed' },
      { priceCents: 9900, listPriceCents: 0 },
    );
    expect(err).toBeNull();
  });

  it('validación server-side bloquea listPriceCents < priceCents cuando listPrice > 0', () => {
    const err = validateOperationalPriceChange(
      { code: 'I04', pricingMode: 'fixed' },
      { priceCents: 9900, listPriceCents: 5000 },
    );
    expect(err).not.toBeNull();
  });
});

// ─── I. Visibilidad portal: regla de categoría activa ────────────────────────

describe('Admin catalog QA: visibilidad portal requiere categoría activa', () => {
  it('setear visibleInPortal=true sin categoría falla validación', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: null, portalCategoryActive: null, rules: [] },
    );
    expect(err).not.toBeNull();
  });

  it('setear visibleInPortal=true con categoría inactiva falla validación', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: 'cat_ecommerce', portalCategoryActive: false, rules: [] },
    );
    expect(err).not.toBeNull();
    expect(err).toMatch(/activa/i);
  });

  it('setear visibleInPortal=true con categoría activa pasa validación', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: 'cat_catalog', portalCategoryActive: true, rules: [] },
    );
    expect(err).toBeNull();
  });
});

// ─── J. retiredCapabilityCodes y PRICE_REBASE no existen ─────────────────────

describe('Admin catalog QA: artefactos obsoletos ausentes', () => {
  it('retiredCapabilityCodes no existe en el seed (limpieza total)', () => {
    expect((catalogDefaults as unknown as { retiredCapabilityCodes?: unknown }).retiredCapabilityCodes).toBeUndefined();
  });

  it('seedVersion es 1.4.1', () => {
    expect(catalogDefaults.seedVersion).toBe('1.4.1');
  });
});

// ─── K0. Guard visibilidad portal admin-only: validación pure-helper ─────────

describe('Admin catalog QA: guard visibilidad portal admin-only/internal', () => {
  // El server action usa isCatalogPortalVisibilityEditable antes de persistir.
  // Cubrimos el helper puro que el action consume.

  const adminOnlyPortalCodes = ['EM01', 'EM02', 'EC01', 'EC03', 'EC04', 'EC05', 'EC07'];
  const coreCodes = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'WA01'];
  const legacyCodes = ['LM01', 'LM02', 'LM03', 'LM04', 'LM05'];

  for (const code of adminOnlyPortalCodes) {
    it(`${code} isCatalogPortalVisibilityEditable=false (admin-only/internal)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });
  }

  for (const code of coreCodes) {
    it(`${code} isCatalogPortalVisibilityEditable=false (core-base)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });
  }

  for (const code of legacyCodes) {
    it(`${code} isCatalogPortalVisibilityEditable=false (legacy-maintenance)`, () => {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    });
  }

  it('I04 isCatalogPortalVisibilityEditable=true (capacidad real del portal)', () => {
    expect(isCatalogPortalVisibilityEditable('I04')).toBe(true);
  });

  it('CM02 isCatalogPortalVisibilityEditable=true', () => {
    expect(isCatalogPortalVisibilityEditable('CM02')).toBe(true);
  });

  it('WA03 isCatalogPortalVisibilityEditable=true', () => {
    expect(isCatalogPortalVisibilityEditable('WA03')).toBe(true);
  });

  it('XI01 isCatalogPortalVisibilityEditable=true', () => {
    expect(isCatalogPortalVisibilityEditable('XI01')).toBe(true);
  });

  it('validateCatalogItemUpdate rechaza visibleInPortal=true para I04 sin categoría', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: null, portalCategoryActive: null, rules: [] },
    );
    expect(err).not.toBeNull();
  });

  it('validateCatalogItemUpdate rechaza visibleInPortal=true para I04 con categoría inactiva', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: 'cat_ecommerce', portalCategoryActive: false, rules: [] },
    );
    expect(err).not.toBeNull();
  });

  it('validateCatalogItemUpdate permite visibleInPortal=true para I04 con categoría activa', () => {
    const err = validateCatalogItemUpdate(
      { visibleInPortal: true },
      { code: 'I04', effectivePortalCategoryId: 'cat_catalog', portalCategoryActive: true, rules: [] },
    );
    expect(err).toBeNull();
  });
});

// ─── K. Capacidades clave de referencia ──────────────────────────────────────

describe('Admin catalog QA: capacidades clave', () => {
  it('B01 internalName no contiene WaaS', () => {
    const b01 = caps.find((c) => c.code === 'B01') as { internalName: string } | undefined;
    expect(b01!.internalName).not.toContain('WaaS');
  });

  it('B04 no promete buzón mensual incluido', () => {
    const b04 = caps.find((c) => c.code === 'B04') as { publicDescription: string; publicName: string } | undefined;
    expect(b04!.publicName).toBe('Setup de correo profesional');
    expect(b04!.publicDescription.toLowerCase()).not.toContain('buzón mensual');
  });

  it('B06 no es visible en portal ni tickets', () => {
    const b06 = caps.find((c) => c.code === 'B06') as { visibleInPortal: boolean; visibleInTickets: boolean } | undefined;
    expect(b06!.visibleInPortal).toBe(false);
    expect(b06!.visibleInTickets).toBe(false);
  });

  it('WA03 BASIC=paid, PRO/BUSINESS=included, LEGACY=quote', () => {
    const wa03 = caps.find((c) => c.code === 'WA03') as { planRules: Record<string, { availability: string }> } | undefined;
    expect(wa03!.planRules['BASIC'].availability).toBe('paid');
    expect(wa03!.planRules['PRO'].availability).toBe('included');
    expect(wa03!.planRules['BUSINESS'].availability).toBe('included');
    expect(wa03!.planRules['LEGACY'].availability).toBe('quote');
  });

  it('XI01 BASIC=paid, PRO/BUSINESS=included', () => {
    const xi01 = caps.find((c) => c.code === 'XI01') as { planRules: Record<string, { availability: string }> } | undefined;
    expect(xi01!.planRules['BASIC'].availability).toBe('paid');
    expect(xi01!.planRules['PRO'].availability).toBe('included');
    expect(xi01!.planRules['BUSINESS'].availability).toBe('included');
  });

  it('CM02 visibleInPortal=true, BASIC=paid, PRO/BUSINESS=included', () => {
    const cm02 = caps.find((c) => c.code === 'CM02') as { visibleInPortal: boolean; planRules: Record<string, { availability: string }> } | undefined;
    expect(cm02!.visibleInPortal).toBe(true);
    expect(cm02!.planRules['BASIC'].availability).toBe('paid');
    expect(cm02!.planRules['PRO'].availability).toBe('included');
    expect(cm02!.planRules['BUSINESS'].availability).toBe('included');
  });

  it('C04 BASIC=paid (no unavailable)', () => {
    const c04 = caps.find((c) => c.code === 'C04') as { planRules: Record<string, { availability: string }> } | undefined;
    expect(c04!.planRules['BASIC'].availability).toBe('paid');
  });

  it('I04 no está en cat_new_features (debe estar en cat_catalog)', () => {
    const i04 = caps.find((c) => c.code === 'I04') as { portalCategory: string } | undefined;
    expect(i04!.portalCategory).not.toBe('cat_new_features');
    expect(i04!.portalCategory).toBe('cat_catalog');
  });
});
