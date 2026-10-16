import { describe, it, expect } from 'vitest';
import {
  detectPlan,
  getPlanPriceCents,
  getPlanLabel,
  suggestedAddOnToCatalogCode,
} from '@/lib/intake/plan-detector';
import type { FeatureChecklist } from '@/lib/intake/types';

const noFeatures: FeatureChecklist = {
  needsBooking: false,
  needsCatalog: false,
  needsCheckout: false,
  needsBlog: false,
  needsCrmIntegration: false,
  needsMultiEmployeeCalendar: false,
  wantsOwnership: false,
};

describe('detectPlan — plan base', () => {
  it('ninguna feature → BASIC', () => {
    const result = detectPlan(noFeatures);
    expect(result.plan).toBe('BASIC');
    expect(result.requiresReview).toBe(false);
  });

  it('needsBooking = true → PRO', () => {
    const result = detectPlan({ ...noFeatures, needsBooking: true });
    expect(result.plan).toBe('PRO');
    expect(result.requiresReview).toBe(false);
  });

  it('needsCheckout = true → BUSINESS', () => {
    const result = detectPlan({ ...noFeatures, needsCheckout: true });
    expect(result.plan).toBe('BUSINESS');
  });

  it('needsCatalog = true → BUSINESS', () => {
    const result = detectPlan({ ...noFeatures, needsCatalog: true });
    expect(result.plan).toBe('BUSINESS');
  });

  it('needsCatalog + needsCheckout → BUSINESS (ambos)', () => {
    const result = detectPlan({ ...noFeatures, needsCatalog: true, needsCheckout: true });
    expect(result.plan).toBe('BUSINESS');
    expect(result.reasons).toHaveLength(2);
  });

  it('wantsOwnership = true → LEGACY (prioridad máxima)', () => {
    const result = detectPlan({ ...noFeatures, wantsOwnership: true });
    expect(result.plan).toBe('LEGACY');
    expect(result.requiresReview).toBe(true);
  });

  it('wantsOwnership + needsCheckout → LEGACY (ownership gana)', () => {
    const result = detectPlan({ ...noFeatures, wantsOwnership: true, needsCheckout: true });
    expect(result.plan).toBe('LEGACY');
  });

  it('wantsOwnership + needsBooking → LEGACY', () => {
    const result = detectPlan({ ...noFeatures, wantsOwnership: true, needsBooking: true });
    expect(result.plan).toBe('LEGACY');
  });

  it('needsCheckout gana sobre needsBooking → BUSINESS', () => {
    const result = detectPlan({ ...noFeatures, needsCheckout: true, needsBooking: true });
    expect(result.plan).toBe('BUSINESS');
  });

  it('needsCatalog gana sobre needsBooking → BUSINESS', () => {
    const result = detectPlan({ ...noFeatures, needsCatalog: true, needsBooking: true });
    expect(result.plan).toBe('BUSINESS');
  });
});

describe('detectPlan — add-ons (independientes del plan)', () => {
  it('needsBlog → add-on C02_blog_engine', () => {
    const result = detectPlan({ ...noFeatures, needsBlog: true });
    expect(result.suggestedAddOns.map((a) => a.key)).toContain('C02_blog_engine');
  });

  it('needsCrmIntegration → add-on I01_crm_sync', () => {
    const result = detectPlan({ ...noFeatures, needsCrmIntegration: true });
    expect(result.suggestedAddOns.map((a) => a.key)).toContain('I01_crm_sync');
  });

  it('needsMultiEmployeeCalendar → add-on I02_advanced_booking', () => {
    const result = detectPlan({ ...noFeatures, needsMultiEmployeeCalendar: true });
    expect(result.suggestedAddOns.map((a) => a.key)).toContain('I02_advanced_booking');
  });

  it('materialStatus = no_tiene_nada → add-on C01_copywriting', () => {
    const result = detectPlan(noFeatures, 'no_tiene_nada');
    expect(result.suggestedAddOns.map((a) => a.key)).toContain('C01_copywriting');
  });

  it('materialStatus = tiene_todo → NO add-on C01_copywriting', () => {
    const result = detectPlan(noFeatures, 'tiene_todo');
    expect(result.suggestedAddOns.map((a) => a.key)).not.toContain('C01_copywriting');
  });

  it('sin features → 0 add-ons', () => {
    const result = detectPlan(noFeatures);
    expect(result.suggestedAddOns).toHaveLength(0);
  });

  it('todos los add-ons activados a la vez', () => {
    const result = detectPlan(
      { ...noFeatures, needsBlog: true, needsCrmIntegration: true, needsMultiEmployeeCalendar: true },
      'no_tiene_nada'
    );
    expect(result.suggestedAddOns).toHaveLength(4);
  });

  it('add-ons se sugieren en LEGACY también', () => {
    const result = detectPlan({ ...noFeatures, wantsOwnership: true, needsBlog: true });
    expect(result.plan).toBe('LEGACY');
    expect(result.suggestedAddOns.map((a) => a.key)).toContain('C02_blog_engine');
  });
});

describe('getPlanPriceCents', () => {
  it('BASIC = 4900 cents ($49)', () => expect(getPlanPriceCents('BASIC')).toBe(4900));
  it('PRO = 8900 cents ($89)', () => expect(getPlanPriceCents('PRO')).toBe(8900));
  it('BUSINESS = 13900 cents ($139)', () => expect(getPlanPriceCents('BUSINESS')).toBe(13900));
  it('LEGACY = 0 (custom pricing)', () => expect(getPlanPriceCents('LEGACY')).toBe(0));
});

describe('getPlanLabel', () => {
  it('BASIC tiene etiqueta con precio', () => {
    expect(getPlanLabel('BASIC')).toContain('$49');
  });
  it('LEGACY tiene etiqueta de propuesta personalizada', () => {
    expect(getPlanLabel('LEGACY')).toContain('personalizada');
  });
});

// plan-detector no devuelve códigos obsoletos
describe('detectPlan — sin códigos obsoletos', () => {
  const OBSOLETE_OUTPUT_CODES = new Set([
    'C02', 'I03', 'BX01', 'BX02', 'BX03', 'BX04', 'BX05', 'BX06',
    'CE05', 'CE06', 'CE07', 'CE08', 'CE09', 'CE10',
    'MP01', 'MP02', 'MP03', 'MP04', 'MP05', 'MP06', 'MP07',
  ]);

  it('detectPlan outputs nunca contienen códigos obsoletos como catalogCode', () => {
    const features = {
      needsBooking: true,
      needsCatalog: true,
      needsCheckout: true,
      needsBlog: true,
      needsCrmIntegration: true,
      needsMultiEmployeeCalendar: true,
      wantsOwnership: false,
    };
    const result = detectPlan(features, 'no_tiene_nada');
    for (const addon of result.suggestedAddOns) {
      const code = suggestedAddOnToCatalogCode(addon.key);
      expect(OBSOLETE_OUTPUT_CODES.has(code ?? ''), `código obsoleto: ${code}`).toBe(false);
    }
  });

  it('C02_blog_engine.catalogCode es C02A (no C02 bare)', () => {
    expect(suggestedAddOnToCatalogCode('C02_blog_engine')).toBe('C02A');
    expect(suggestedAddOnToCatalogCode('C02_blog_engine')).not.toBe('C02');
  });
});

// catalog code mapping
describe('suggestedAddOnToCatalogCode', () => {
  it('C01_copywriting → C01', () => {
    expect(suggestedAddOnToCatalogCode('C01_copywriting')).toBe('C01');
  });
  it('C02_blog_engine → C02A (blog/sección de noticias canónico)', () => {
    expect(suggestedAddOnToCatalogCode('C02_blog_engine')).toBe('C02A');
  });
  it('I01_crm_sync → I01', () => {
    expect(suggestedAddOnToCatalogCode('I01_crm_sync')).toBe('I01');
  });
  it('I02_advanced_booking → I02', () => {
    expect(suggestedAddOnToCatalogCode('I02_advanced_booking')).toBe('I02');
  });
  it('clave desconocida → null', () => {
    expect(suggestedAddOnToCatalogCode('X99_unknown')).toBeNull();
  });
  it('todos los add-ons sugeridos por detectPlan tienen catalogCode válido', () => {
    const result = detectPlan(
      { needsBlog: true, needsCrmIntegration: true, needsMultiEmployeeCalendar: true,
        needsBooking: false, needsCatalog: false, needsCheckout: false, wantsOwnership: false },
      'no_tiene_nada'
    );
    for (const addon of result.suggestedAddOns) {
      const code = suggestedAddOnToCatalogCode(addon.key);
      expect(code).not.toBeNull();
      // Code format: letter(s) + digits + optional letter suffix (e.g. C02A, I01, E02)
      expect(code).toMatch(/^[A-Z]{1,2}\d{2}[A-Z]?$/);
    }
  });
});
