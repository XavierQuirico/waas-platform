import { describe, it, expect } from 'vitest';
import {
  mapCapabilitiesToFeatureChecklist,
  deriveMaterialStatus,
  resolveIntakeFitStatus,
  getReviewReasonCodes,
} from '@/lib/intake/v2-normalizers';
import { detectPlan } from '@/lib/intake/plan-detector';
import type { NeededCapability, BrandAssetsStatus, PhotosStatus, CopyStatus } from '@/lib/intake/types';

// ─── mapCapabilitiesToFeatureChecklist ────────────────────────────────────────

describe('mapCapabilitiesToFeatureChecklist', () => {
  it('array vacío → todos en false', () => {
    const result = mapCapabilitiesToFeatureChecklist([]);
    expect(result.needsBooking).toBe(false);
    expect(result.needsCatalog).toBe(false);
    expect(result.needsCheckout).toBe(false);
    expect(result.needsBlog).toBe(false);
    expect(result.wantsOwnership).toBe(false);
    expect(result.needsCrmIntegration).toBe(false);
    expect(result.needsMultiEmployeeCalendar).toBe(false);
  });

  it('booking → needsBooking', () => {
    expect(mapCapabilitiesToFeatureChecklist(['booking']).needsBooking).toBe(true);
  });

  it('catalog → needsCatalog', () => {
    expect(mapCapabilitiesToFeatureChecklist(['catalog']).needsCatalog).toBe(true);
  });

  it('online_payments → needsCheckout', () => {
    expect(mapCapabilitiesToFeatureChecklist(['online_payments']).needsCheckout).toBe(true);
  });

  it('blog → needsBlog', () => {
    expect(mapCapabilitiesToFeatureChecklist(['blog']).needsBlog).toBe(true);
  });

  it('ownership → wantsOwnership', () => {
    expect(mapCapabilitiesToFeatureChecklist(['ownership']).wantsOwnership).toBe(true);
  });

  it('crm_integration → needsCrmIntegration', () => {
    expect(mapCapabilitiesToFeatureChecklist(['crm_integration']).needsCrmIntegration).toBe(true);
  });

  it('multi_service_calendar → needsMultiEmployeeCalendar', () => {
    expect(
      mapCapabilitiesToFeatureChecklist(['multi_service_calendar']).needsMultiEmployeeCalendar
    ).toBe(true);
  });

  it('contact_requests no mapea a ninguna feature legacy (es informativo)', () => {
    const result = mapCapabilitiesToFeatureChecklist(['contact_requests']);
    expect(result.needsBooking).toBe(false);
    expect(result.needsCatalog).toBe(false);
    expect(result.needsCheckout).toBe(false);
    expect(result.wantsOwnership).toBe(false);
  });

  it('todas las capabilities a la vez → todos en true', () => {
    const all: NeededCapability[] = [
      'booking', 'catalog', 'online_payments', 'blog',
      'ownership', 'crm_integration', 'multi_service_calendar', 'contact_requests',
    ];
    const result = mapCapabilitiesToFeatureChecklist(all);
    expect(result.needsBooking).toBe(true);
    expect(result.needsCatalog).toBe(true);
    expect(result.needsCheckout).toBe(true);
    expect(result.needsBlog).toBe(true);
    expect(result.wantsOwnership).toBe(true);
    expect(result.needsCrmIntegration).toBe(true);
    expect(result.needsMultiEmployeeCalendar).toBe(true);
  });

  it('mapCapabilities + detectPlan → booking produce PRO', () => {
    const checklist = mapCapabilitiesToFeatureChecklist(['booking']);
    expect(detectPlan(checklist).plan).toBe('PRO');
  });

  it('mapCapabilities + detectPlan → online_payments produce BUSINESS', () => {
    const checklist = mapCapabilitiesToFeatureChecklist(['online_payments']);
    expect(detectPlan(checklist).plan).toBe('BUSINESS');
  });

  it('mapCapabilities + detectPlan → ownership produce LEGACY', () => {
    const checklist = mapCapabilitiesToFeatureChecklist(['ownership']);
    expect(detectPlan(checklist).plan).toBe('LEGACY');
  });
});

// ─── deriveMaterialStatus ─────────────────────────────────────────────────────

describe('deriveMaterialStatus', () => {
  it('no_clear_brand → no_tiene_nada (sin importar photos/copy)', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'no_clear_brand', photosStatus: 'ready', copyStatus: 'ready' })
    ).toBe('no_tiene_nada');
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'no_clear_brand', photosStatus: 'needs_help', copyStatus: 'needs_help' })
    ).toBe('no_tiene_nada');
  });

  it('has_logo + photos ready + copy ready → tiene_todo', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'has_logo', photosStatus: 'ready', copyStatus: 'ready' })
    ).toBe('tiene_todo');
  });

  it('has_logo_and_brand + photos ready + copy ready → tiene_todo', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'has_logo_and_brand', photosStatus: 'ready', copyStatus: 'ready' })
    ).toBe('tiene_todo');
  });

  it('has_logo + photos not ready → tiene_logo_no_fotos', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'has_logo', photosStatus: 'needs_stock', copyStatus: 'ready' })
    ).toBe('tiene_logo_no_fotos');
  });

  it('has_logo + copy not ready → tiene_logo_no_fotos', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'has_logo', photosStatus: 'ready', copyStatus: 'ideas_only' })
    ).toBe('tiene_logo_no_fotos');
  });

  it('has_logo_and_brand + photos needs_help + copy needs_help → tiene_logo_no_fotos', () => {
    expect(
      deriveMaterialStatus({ brandAssetsStatus: 'has_logo_and_brand', photosStatus: 'needs_help', copyStatus: 'needs_help' })
    ).toBe('tiene_logo_no_fotos');
  });
});

// ─── resolveIntakeFitStatus ───────────────────────────────────────────────────

describe('resolveIntakeFitStatus', () => {
  it('requiresReview=true → custom_review', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BASIC', recommendedPlan: 'BASIC', requiresReview: true })
    ).toBe('custom_review');
  });

  it('recommendedPlan=LEGACY → custom_review', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BUSINESS', recommendedPlan: 'LEGACY', requiresReview: false })
    ).toBe('custom_review');
  });

  it('sin intent → matches_intent', () => {
    expect(
      resolveIntakeFitStatus({ recommendedPlan: 'PRO', requiresReview: false })
    ).toBe('matches_intent');
  });

  it('intent=BASIC, recomendado=BASIC → matches_intent', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BASIC', recommendedPlan: 'BASIC', requiresReview: false })
    ).toBe('matches_intent');
  });

  it('intent=PRO, recomendado=PRO → matches_intent', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'PRO', recommendedPlan: 'PRO', requiresReview: false })
    ).toBe('matches_intent');
  });

  it('intent=BUSINESS, recomendado=BUSINESS → matches_intent', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BUSINESS', recommendedPlan: 'BUSINESS', requiresReview: false })
    ).toBe('matches_intent');
  });

  it('intent=BASIC, recomendado=PRO → suggested_change', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BASIC', recommendedPlan: 'PRO', requiresReview: false })
    ).toBe('suggested_change');
  });

  it('intent=BASIC, recomendado=BUSINESS → suggested_change', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BASIC', recommendedPlan: 'BUSINESS', requiresReview: false })
    ).toBe('suggested_change');
  });

  it('intent=PRO, recomendado=BUSINESS → suggested_change', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'PRO', recommendedPlan: 'BUSINESS', requiresReview: false })
    ).toBe('suggested_change');
  });

  it('intent=BUSINESS, recomendado=BASIC → matches_intent (recomendado más barato que intent = ok)', () => {
    // El cliente eligió PRO pero no necesita tanto — no es un problema de under-scope
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'BUSINESS', recommendedPlan: 'BASIC', requiresReview: false })
    ).toBe('matches_intent');
  });

  it('intent=PRO, recomendado=BASIC → matches_intent', () => {
    expect(
      resolveIntakeFitStatus({ selectedPlanIntent: 'PRO', recommendedPlan: 'BASIC', requiresReview: false })
    ).toBe('matches_intent');
  });
});

// ─── getReviewReasonCodes ─────────────────────────────────────────────────────

const base = {
  selectedPlanIntent: 'PRO' as const,
  recommendedPlan: 'PRO' as const,
  capabilities: [] as NeededCapability[],
  brandAssetsStatus: 'has_logo' as BrandAssetsStatus,
  photosStatus: 'ready' as PhotosStatus,
  copyStatus: 'ready' as CopyStatus,
  deadlineExpectation: 'this_month' as const,
};

describe('getReviewReasonCodes', () => {
  it('base limpio → 0 códigos', () => {
    expect(getReviewReasonCodes(base)).toHaveLength(0);
  });

  it('ownership → OWNERSHIP_REQUIRES_CUSTOM (primer código)', () => {
    const codes = getReviewReasonCodes({ ...base, capabilities: ['ownership'] });
    expect(codes[0]).toBe('OWNERSHIP_REQUIRES_CUSTOM');
  });

  it('plan bajo para lo que pide → PLAN_INTENT_UNDER_SCOPED', () => {
    const codes = getReviewReasonCodes({
      ...base,
      selectedPlanIntent: 'BASIC',
      recommendedPlan: 'PRO',
    });
    expect(codes).toContain('PLAN_INTENT_UNDER_SCOPED');
  });

  it('no_clear_brand → NO_CLEAR_BRAND', () => {
    const codes = getReviewReasonCodes({ ...base, brandAssetsStatus: 'no_clear_brand' });
    expect(codes).toContain('NO_CLEAR_BRAND');
  });

  it('photos not ready → MISSING_PHOTOS', () => {
    expect(getReviewReasonCodes({ ...base, photosStatus: 'needs_stock' })).toContain('MISSING_PHOTOS');
    expect(getReviewReasonCodes({ ...base, photosStatus: 'needs_help' })).toContain('MISSING_PHOTOS');
  });

  it('copy not ready → MISSING_COPY', () => {
    expect(getReviewReasonCodes({ ...base, copyStatus: 'ideas_only' })).toContain('MISSING_COPY');
    expect(getReviewReasonCodes({ ...base, copyStatus: 'needs_help' })).toContain('MISSING_COPY');
  });

  it('photos ready, copy ready → no MISSING_PHOTOS, no MISSING_COPY', () => {
    const codes = getReviewReasonCodes(base);
    expect(codes).not.toContain('MISSING_PHOTOS');
    expect(codes).not.toContain('MISSING_COPY');
  });

  it('deadline asap → FAST_DEADLINE', () => {
    expect(getReviewReasonCodes({ ...base, deadlineExpectation: 'asap' })).toContain('FAST_DEADLINE');
  });

  it('deadline this_week → FAST_DEADLINE', () => {
    expect(getReviewReasonCodes({ ...base, deadlineExpectation: 'this_week' })).toContain('FAST_DEADLINE');
  });

  it('deadline this_month → no FAST_DEADLINE', () => {
    expect(getReviewReasonCodes({ ...base, deadlineExpectation: 'this_month' })).not.toContain('FAST_DEADLINE');
  });

  it('deadline no_rush → no FAST_DEADLINE', () => {
    expect(getReviewReasonCodes({ ...base, deadlineExpectation: 'no_rush' })).not.toContain('FAST_DEADLINE');
  });

  it('online_payments → ONLINE_PAYMENTS', () => {
    expect(getReviewReasonCodes({ ...base, capabilities: ['online_payments'] })).toContain('ONLINE_PAYMENTS');
  });

  it('catalog → CATALOG', () => {
    expect(getReviewReasonCodes({ ...base, capabilities: ['catalog'] })).toContain('CATALOG');
  });

  it('booking → BOOKING', () => {
    expect(getReviewReasonCodes({ ...base, capabilities: ['booking'] })).toContain('BOOKING');
  });

  it('crm_integration → CRM_INTEGRATION', () => {
    expect(getReviewReasonCodes({ ...base, capabilities: ['crm_integration'] })).toContain('CRM_INTEGRATION');
  });

  it('multi_service_calendar → MULTI_SERVICE_CALENDAR', () => {
    expect(
      getReviewReasonCodes({ ...base, capabilities: ['multi_service_calendar'] })
    ).toContain('MULTI_SERVICE_CALENDAR');
  });

  it('todo junto → todos los códigos presentes', () => {
    const codes = getReviewReasonCodes({
      selectedPlanIntent: 'BASIC',
      recommendedPlan: 'BUSINESS',
      capabilities: ['ownership', 'online_payments', 'catalog', 'booking', 'crm_integration', 'multi_service_calendar'],
      brandAssetsStatus: 'no_clear_brand',
      photosStatus: 'needs_help',
      copyStatus: 'needs_help',
      deadlineExpectation: 'asap',
    });
    expect(codes).toContain('OWNERSHIP_REQUIRES_CUSTOM');
    expect(codes).toContain('PLAN_INTENT_UNDER_SCOPED');
    expect(codes).toContain('NO_CLEAR_BRAND');
    expect(codes).toContain('MISSING_PHOTOS');
    expect(codes).toContain('MISSING_COPY');
    expect(codes).toContain('FAST_DEADLINE');
    expect(codes).toContain('ONLINE_PAYMENTS');
    expect(codes).toContain('CATALOG');
    expect(codes).toContain('BOOKING');
    expect(codes).toContain('CRM_INTEGRATION');
    expect(codes).toContain('MULTI_SERVICE_CALENDAR');
  });
});
