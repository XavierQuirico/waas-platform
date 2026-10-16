import { describe, expect, it } from 'vitest';
import catalogDefaults from '@/db/seeds/catalog-defaults.json';
import { toCatalogCode, getComponentById } from '@/lib/calculadora/catalog-components';
import { maintenanceTierEnum } from '@/db/schema/maintenance-contracts';

describe('catalog defaults seed', () => {
  it('matches the approved commercial matrix contract v1.4.1', () => {
    const visibleCapabilities = catalogDefaults.capabilities.filter(
      (capability) => capability.visibleInPortal,
    );

    expect(catalogDefaults.seedVersion).toBe('1.4.1');
    expect(catalogDefaults.portalCategories).toHaveLength(7);
    expect(catalogDefaults.capabilities).toHaveLength(47);
    expect(visibleCapabilities).toHaveLength(27);
  });

  it('keeps every portal-visible capability assigned to a portal category', () => {
    const categoryIds = new Set(catalogDefaults.portalCategories.map((category) => category.id));
    const visibleWithoutCategory = catalogDefaults.capabilities.filter(
      (capability) => capability.visibleInPortal && !categoryIds.has(capability.portalCategory ?? ''),
    );

    expect(visibleWithoutCategory).toHaveLength(0);
  });

  it('no contiene códigos obsoletos eliminados', () => {
    const obsoleteCodes = new Set([
      'M01','M02','M03','M04','M05','M06',
      'I03',
      'BX01','BX02','BX03','BX04','BX05','BX06',
      'CE05','CE06','CE07','CE08','CE09','CE10','CE11','CE12','CE13','CE14','CE15','CE16',
      'VT01','VT02','VT03','VT04','VT05','VT06','VT07','VT08',
      'MP01','MP02','MP03','MP04','MP05','MP06','MP07',
      'XI03','XI04','XI10',
      'XS01','XS02','XS03',
      'CA01','CA03','CA04',
      'C02', // reemplazado por C02A y C02B
      // v1.4.0 retirados
      'D04','XI02','XI05','XI06','XI07','XI08','XI09',
      'CM01','EM03','EM04','CE03','EC02','EC06','EC08',
    ]);
    const presentCodes = new Set(catalogDefaults.capabilities.map((c: { code: string }) => c.code));
    for (const code of obsoleteCodes) {
      expect(presentCodes.has(code), `código obsoleto ${code} aún presente`).toBe(false);
    }
  });

  it('C02A y C02B reemplazan a C02', () => {
    const codes = catalogDefaults.capabilities.map((c: { code: string }) => c.code);
    expect(codes).toContain('C02A');
    expect(codes).toContain('C02B');
    expect(codes).not.toContain('C02');
  });

  it('CA02 es recursos visuales, no actualización de catálogo', () => {
    const ca02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'CA02');
    expect(ca02).toBeDefined();
    expect((ca02 as { publicName: string }).publicName.toLowerCase()).toContain('visual');
  });

  it('CA02 internalName no contiene "Fotos Stock 20"', () => {
    const ca02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'CA02') as { internalName: string } | undefined;
    expect(ca02).toBeDefined();
    expect(ca02!.internalName).not.toContain('Fotos Stock');
  });

  it('LM01-LM04 son planes de mantenimiento LEGACY fixed, LM05 es quote', () => {
    const lmFixed = ['LM01', 'LM02', 'LM03', 'LM04'];
    for (const code of lmFixed) {
      const cap = catalogDefaults.capabilities.find((c: { code: string }) => c.code === code) as {
        pricingMode: string;
        planRules: { BASIC: { availability: string }; LEGACY: { availability: string } };
      } | undefined;
      expect(cap).toBeDefined();
      expect(cap!.pricingMode).toBe('fixed');
      expect(cap!.planRules.BASIC.availability).toBe('unavailable');
      expect(cap!.planRules.LEGACY.availability).toBe('paid');
    }
    // LM05 es quote
    const lm05 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'LM05') as {
      pricingMode: string;
      publicName: string;
      priceCents: number | null;
      planRules: { LEGACY: { availability: string } };
    } | undefined;
    expect(lm05).toBeDefined();
    expect(lm05!.pricingMode).toBe('quote');
    expect(lm05!.publicName).toBe('Hosting personalizado');
    expect(lm05!.priceCents).toBeNull();
    expect(lm05!.planRules.LEGACY.availability).toBe('quote');
  });

  it('LM01-LM05 tienen visibleInPortal false (mantenimiento admin-only)', () => {
    const lmCodes = ['LM01', 'LM02', 'LM03', 'LM04', 'LM05'];
    for (const code of lmCodes) {
      const cap = catalogDefaults.capabilities.find((c: { code: string }) => c.code === code);
      expect(cap).toBeDefined();
      expect((cap as { visibleInPortal: boolean }).visibleInPortal).toBe(false);
    }
  });

  it('LM04 priceCents es 2000 (no cotización)', () => {
    const lm04 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'LM04') as { priceCents: number } | undefined;
    expect(lm04).toBeDefined();
    expect(lm04!.priceCents).toBe(2000);
  });

  it('EM01 y EM02 tienen visibleInPortal false (emails admin-only)', () => {
    for (const code of ['EM01', 'EM02']) {
      const cap = catalogDefaults.capabilities.find((c: { code: string }) => c.code === code);
      expect(cap).toBeDefined();
      expect((cap as { visibleInPortal: boolean }).visibleInPortal).toBe(false);
    }
  });

  it('EM01 precio $49, EM02 precio $89', () => {
    const em01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EM01') as { priceCents: number } | undefined;
    const em02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EM02') as { priceCents: number } | undefined;
    expect(em01).toBeDefined();
    expect(em01!.priceCents).toBe(4900);
    expect(em02).toBeDefined();
    expect(em02!.priceCents).toBe(8900);
  });

  it('el catálogo publicado no incluye notas comerciales internas', () => {
    for (const cap of catalogDefaults.capabilities) {
      expect((cap as { adminNotes?: string | null }).adminNotes ?? null).toBeNull();
    }
  });

  it('I02 publicDescription no promete pagos online ni SMS como funcionalidad incluida', () => {
    const i02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'I02') as { publicDescription: string } | undefined;
    expect(i02).toBeDefined();
    expect(i02!.publicDescription).not.toContain('pagos en línea y recordatorios automáticos');
    expect(i02!.publicDescription).not.toContain('pagos en línea y');
  });

  // ─── v1.3.0 contract tests ────────────────────────────────────────────────

  it('T01 pricingMode included, priceCents 0, todos los planes included', () => {
    const t01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'T01') as {
      pricingMode: string;
      priceCents: number;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(t01).toBeDefined();
    expect(t01!.pricingMode).toBe('included');
    expect(t01!.priceCents).toBe(0);
    for (const plan of ['BASIC', 'PRO', 'BUSINESS', 'LEGACY']) {
      expect(t01!.planRules[plan].availability).toBe('included');
    }
  });

  it('WA03 pricingMode fixed, priceCents 9900, BASIC paid', () => {
    const wa03 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'WA03') as {
      pricingMode: string;
      priceCents: number;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(wa03).toBeDefined();
    expect(wa03!.pricingMode).toBe('fixed');
    expect(wa03!.priceCents).toBe(9900);
    expect(wa03!.planRules['BASIC'].availability).toBe('paid');
  });

  it('XI01 PRO/BUSINESS included', () => {
    const xi01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'XI01') as {
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(xi01).toBeDefined();
    expect(xi01!.planRules['PRO'].availability).toBe('included');
    expect(xi01!.planRules['BUSINESS'].availability).toBe('included');
  });

  it('I01 BUSINESS paid (no longer included)', () => {
    const i01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'I01') as {
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(i01).toBeDefined();
    expect(i01!.planRules['BUSINESS'].availability).toBe('paid');
  });

  it('I02 PRO/BUSINESS paid (reservas avanzadas separadas del plan)', () => {
    const i02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'I02') as {
      planRules: Record<string, { availability: string; inclusionScope: string | null }>;
    } | undefined;
    expect(i02).toBeDefined();
    expect(i02!.planRules['PRO'].availability).toBe('paid');
    expect(i02!.planRules['PRO'].inclusionScope).toBeNull();
    expect(i02!.planRules['BUSINESS'].availability).toBe('paid');
    expect(i02!.planRules['BUSINESS'].inclusionScope).toBeNull();
  });

  it('C04 BASIC paid (no longer unavailable)', () => {
    const c04 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'C04') as {
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(c04).toBeDefined();
    expect(c04!.planRules['BASIC'].availability).toBe('paid');
  });

  it('C05 existe y todos los planes son quote', () => {
    const c05 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'C05') as {
      pricingMode: string;
      visibleInPortal: boolean;
      visibleInTickets: boolean;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(c05).toBeDefined();
    expect(c05!.pricingMode).toBe('quote');
    expect(c05!.visibleInPortal).toBe(true);
    expect(c05!.visibleInTickets).toBe(true);
    for (const plan of ['BASIC', 'PRO', 'BUSINESS', 'LEGACY']) {
      expect(c05!.planRules[plan].availability).toBe('quote');
    }
  });

  it('cat_visual_improvements existe en portalCategories', () => {
    const cat = catalogDefaults.portalCategories.find(
      (c: { id: string }) => c.id === 'cat_visual_improvements',
    );
    expect(cat).toBeDefined();
  });

  it('CA02 y CA05 asignados a cat_visual_improvements (D04 retirado)', () => {
    for (const code of ['CA02', 'CA05']) {
      const cap = catalogDefaults.capabilities.find((c: { code: string }) => c.code === code) as {
        portalCategory: string;
      } | undefined;
      expect(cap).toBeDefined();
      expect(cap!.portalCategory).toBe('cat_visual_improvements');
    }
  });

  it('retiredCapabilityCodes no existe en el seed (limpieza total v1.4.1)', () => {
    expect((catalogDefaults as unknown as { retiredCapabilityCodes?: unknown }).retiredCapabilityCodes).toBeUndefined();
  });

  it('I01 internalName no contiene Google Sheets', () => {
    const i01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'I01') as {
      internalName: string;
    } | undefined;
    expect(i01).toBeDefined();
    expect(i01!.internalName.toLowerCase()).not.toContain('sheets');
  });

  it('visibleInPortal count está entre 20 y 35 inclusive', () => {
    const visibleCount = catalogDefaults.capabilities.filter(
      (c: { visibleInPortal: boolean }) => c.visibleInPortal,
    ).length;
    expect(visibleCount).toBeGreaterThanOrEqual(20);
    expect(visibleCount).toBeLessThanOrEqual(35);
  });

  it('matrix y seed tienen seedVersion 1.4.1', () => {
    expect(catalogDefaults.seedVersion).toBe('1.4.1');
  });

  // ─── v1.4.0 contract tests ────────────────────────────────────────────────

  it('C06 existe con precio $29, cat_text_content, visibleInPortal', () => {
    const c06 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'C06') as {
      priceCents: number;
      listPriceCents: number;
      portalCategory: string;
      visibleInPortal: boolean;
      visibleInTickets: boolean;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(c06).toBeDefined();
    expect(c06!.priceCents).toBe(2900);
    expect(c06!.listPriceCents).toBe(2900);
    expect(c06!.portalCategory).toBe('cat_text_content');
    expect(c06!.visibleInPortal).toBe(true);
    expect(c06!.visibleInTickets).toBe(true);
    expect(c06!.planRules['BASIC'].availability).toBe('unavailable');
    expect(c06!.planRules['PRO'].availability).toBe('paid');
    expect(c06!.planRules['BUSINESS'].availability).toBe('paid');
  });

  it('C02B precio $19', () => {
    const c02b = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'C02B') as { priceCents: number; listPriceCents: number } | undefined;
    expect(c02b).toBeDefined();
    expect(c02b!.priceCents).toBe(1900);
    expect(c02b!.listPriceCents).toBe(1900);
  });

  it('I04 precio $99, categoría cat_catalog, Basic/Pro unavailable', () => {
    const i04 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'I04') as {
      priceCents: number;
      portalCategory: string;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(i04).toBeDefined();
    expect(i04!.priceCents).toBe(9900);
    expect(i04!.portalCategory).toBe('cat_catalog');
    expect(i04!.planRules['BASIC'].availability).toBe('unavailable');
    expect(i04!.planRules['PRO'].availability).toBe('unavailable');
    expect(i04!.planRules['BUSINESS'].availability).toBe('paid');
  });

  it('CM02 visibleInPortal, source waas_ticket, PRO/BUSINESS included', () => {
    const cm02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'CM02') as {
      visibleInPortal: boolean;
      source: string;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(cm02).toBeDefined();
    expect(cm02!.visibleInPortal).toBe(true);
    expect(cm02!.source).toBe('waas_ticket');
    expect(cm02!.planRules['PRO'].availability).toBe('included');
    expect(cm02!.planRules['BUSINESS'].availability).toBe('included');
    expect(cm02!.planRules['BASIC'].availability).toBe('paid');
  });

  it('CA05 precio $39', () => {
    const ca05 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'CA05') as { priceCents: number } | undefined;
    expect(ca05).toBeDefined();
    expect(ca05!.priceCents).toBe(3900);
  });

  it('E01 precio $19, E02 precio $49', () => {
    const e01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'E01') as { priceCents: number } | undefined;
    const e02 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'E02') as { priceCents: number } | undefined;
    expect(e01).toBeDefined();
    expect(e01!.priceCents).toBe(1900);
    expect(e02).toBeDefined();
    expect(e02!.priceCents).toBe(4900);
  });

  it('B04 no promete buzón mensual incluido', () => {
    const b04 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'B04') as { publicDescription: string; publicName: string } | undefined;
    expect(b04).toBeDefined();
    expect(b04!.publicDescription.toLowerCase()).not.toContain('buzón mensual');
    expect(b04!.publicDescription.toLowerCase()).not.toContain('buzones mensual');
    expect(b04!.publicDescription.toLowerCase()).not.toContain('paga/gestiona buzones');
    expect(b04!.publicName).toBe('Setup de correo profesional');
  });

  it('B06 no tiene overageAddonCode B06 ni cupo rígido mensual', () => {
    const b06 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'B06') as {
      visibleInPortal: boolean;
      visibleInTickets: boolean;
      planRules: Record<string, { overageAddonCode: string | null; overageMode: string }>;
    } | undefined;
    expect(b06).toBeDefined();
    expect(b06!.visibleInPortal).toBe(false);
    expect(b06!.visibleInTickets).toBe(false);
    for (const plan of ['BASIC', 'PRO', 'BUSINESS']) {
      expect(b06!.planRules[plan].overageAddonCode).not.toBe('B06');
      expect(b06!.planRules[plan].overageMode).toBe('unavailable');
    }
  });

  it('EC01/EC03/EC04/EC05/EC07 visibleInPortal false (módulos internos Legacy)', () => {
    for (const code of ['EC01', 'EC03', 'EC04', 'EC05', 'EC07']) {
      const cap = catalogDefaults.capabilities.find((c: { code: string }) => c.code === code);
      expect(cap).toBeDefined();
      expect((cap as { visibleInPortal: boolean }).visibleInPortal).toBe(false);
      expect((cap as { visibleInTickets: boolean }).visibleInTickets).toBe(false);
    }
  });

  it('EC05 sigue como Portal/login Legacy', () => {
    const ec05 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EC05') as {
      publicName: string;
      planRules: Record<string, { availability: string }>;
    } | undefined;
    expect(ec05).toBeDefined();
    expect(ec05!.publicName).toBe('Portal privado / login');
    expect(ec05!.planRules['LEGACY'].availability).toBe('quote');
  });

  it('EC03/EC04/EC07 renombrados correctamente', () => {
    const ec03 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EC03') as { publicName: string } | undefined;
    const ec04 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EC04') as { publicName: string } | undefined;
    const ec07 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'EC07') as { publicName: string } | undefined;
    expect(ec03!.publicName).toBe('Gestión de inventario');
    expect(ec04!.publicName).toBe('Gestión de pedidos');
    expect(ec07!.publicName).toBe('Membresías o cobros recurrentes');
  });

  it('R01 publicDescription no contiene precio hardcodeado', () => {
    const r01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'R01') as { publicDescription: string } | undefined;
    expect(r01).toBeDefined();
    expect(r01!.publicDescription).not.toContain('$25');
    expect(r01!.publicDescription).not.toContain('25 USD');
  });

  it('B01 internalName es "Hosting incluido", no "Hosting WaaS"', () => {
    const b01 = catalogDefaults.capabilities.find((c: { code: string }) => c.code === 'B01') as { internalName: string } | undefined;
    expect(b01).toBeDefined();
    expect(b01!.internalName).toBe('Hosting incluido');
    expect(b01!.internalName).not.toContain('WaaS');
  });

  // ─── v1.4.1 negative-guard tests ────────────────────────────────────────────

  it('códigos retirados v1.4.0 no existen en capabilities activas', () => {
    const retiredCodes = ['D04','XI02','XI05','XI06','XI07','XI08','XI09','CM01','EM03','EM04','CE03','EC02','EC06','EC08'];
    const presentCodes = new Set(catalogDefaults.capabilities.map((c: { code: string }) => c.code));
    for (const code of retiredCodes) {
      expect(presentCodes.has(code), `código retirado ${code} no debería estar en capabilities`).toBe(false);
    }
  });

  it('EC02/EC06/EC08 (retirados) no están protegidos por QUOTE_ENGINE_CODES', async () => {
    const { QUOTE_ENGINE_CODES } = await import('@/lib/catalog/catalog-safety');
    expect(QUOTE_ENGINE_CODES.has('EC02')).toBe(false);
    expect(QUOTE_ENGINE_CODES.has('EC06')).toBe(false);
    expect(QUOTE_ENGINE_CODES.has('EC08')).toBe(false);
  });

  it('EC01/EC03/EC04/EC05/EC07 (activos) siguen en QUOTE_ENGINE_CODES', async () => {
    const { QUOTE_ENGINE_CODES } = await import('@/lib/catalog/catalog-safety');
    for (const code of ['EC01', 'EC03', 'EC04', 'EC05', 'EC07']) {
      expect(QUOTE_ENGINE_CODES.has(code), `${code} debe estar en QUOTE_ENGINE_CODES`).toBe(true);
    }
  });
});

// ─── Calculadora catalog adapter — contrato v1.4.1 ───────────────────────────

describe('catalog adapter toCatalogCode / getComponentById', () => {
  it('toCatalogCode("live_chat") no devuelve CM01', () => {
    expect(toCatalogCode('live_chat')).not.toBe('CM01');
  });

  it('toCatalogCode("catalog_variants") no devuelve CE03', () => {
    expect(toCatalogCode('catalog_variants')).not.toBe('CE03');
  });

  it('toCatalogCode("cart_basic") no devuelve EC02', () => {
    expect(toCatalogCode('cart_basic')).not.toBe('EC02');
  });

  it('getComponentById("EC02") es undefined (EC02 eliminado del catálogo)', () => {
    expect(getComponentById('EC02')).toBeUndefined();
  });

  it('getComponentById("EC06") es undefined (EC06 eliminado del catálogo)', () => {
    expect(getComponentById('EC06')).toBeUndefined();
  });

  it('getComponentById("EC08") es undefined (EC08 eliminado del catálogo)', () => {
    expect(getComponentById('EC08')).toBeUndefined();
  });
});

// ─── Maintenance schema enum — contrato v1.4.1 ───────────────────────────────

describe('maintenanceTierEnum schema contract', () => {
  it('contiene care, care_plus, care_pro, custom', () => {
    expect(maintenanceTierEnum.enumValues).toContain('care');
    expect(maintenanceTierEnum.enumValues).toContain('care_plus');
    expect(maintenanceTierEnum.enumValues).toContain('care_pro');
    expect(maintenanceTierEnum.enumValues).toContain('custom');
  });

  it('no contiene basic, standard, premium como tiers de mantenimiento', () => {
    expect(maintenanceTierEnum.enumValues).not.toContain('basic');
    expect(maintenanceTierEnum.enumValues).not.toContain('standard');
    expect(maintenanceTierEnum.enumValues).not.toContain('premium');
  });
});
