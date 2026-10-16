// ============================================================
// V2 Normalizers — Wizard Comercial V2
// Funciones puras: mapean V2 ↔ legacy sin efectos secundarios.
// ============================================================

import type {
  FeatureChecklist,
  MaterialStatus,
  DetectedPlan,
  NeededCapability,
  BrandAssetsStatus,
  PhotosStatus,
  CopyStatus,
  DeadlineExpectation,
  SelectedPlanIntent,
  IntakeFitStatus,
  PrimaryProblem,
  PrimaryGoal,
  BrandIdentityStatus,
  DomainStatus,
  CurrentAccessStatus,
  GroqIntakeInterpretation,
} from './types';

// ─── Orden de planes para comparar intención vs. recomendado ──
const PLAN_ORDER: Record<DetectedPlan, number> = {
  BASIC: 0,
  PRO: 1,
  BUSINESS: 2,
  LEGACY: 3,
};

// ─── 1. capabilities → FeatureChecklist (legacy) ─────────────

/**
 * Convierte el array de NeededCapability (V2) al FeatureChecklist
 * que usa el plan-detector y el router legacy.
 */
export function mapCapabilitiesToFeatureChecklist(
  capabilities: NeededCapability[]
): FeatureChecklist {
  const has = (cap: NeededCapability) => capabilities.includes(cap);
  return {
    needsBooking: has('booking'),
    needsCatalog: has('catalog'),
    needsCheckout: has('online_payments'),
    needsBlog: has('blog'),
    wantsOwnership: has('ownership'),
    needsCrmIntegration: has('crm_integration'),
    needsMultiEmployeeCalendar: has('multi_service_calendar'),
  };
}

// ─── 2. V2 materials → MaterialStatus (legacy) ───────────────

/**
 * Deriva el MaterialStatus legacy a partir de los estados V2.
 *
 * Reglas:
 * - no_clear_brand → no_tiene_nada (no hay marca base)
 * - has_logo* + photos ready + copy ready → tiene_todo
 * - has_logo* + cualquier cosa faltante → tiene_logo_no_fotos
 */
export function deriveMaterialStatus(input: {
  brandAssetsStatus: BrandAssetsStatus;
  photosStatus: PhotosStatus;
  copyStatus: CopyStatus;
}): MaterialStatus {
  if (input.brandAssetsStatus === 'no_clear_brand') {
    return 'no_tiene_nada';
  }
  if (input.photosStatus === 'ready' && input.copyStatus === 'ready') {
    return 'tiene_todo';
  }
  return 'tiene_logo_no_fotos';
}

// ─── 3. Fit status ────────────────────────────────────────────

/**
 * Resuelve el IntakeFitStatus del cliente comparando su intención de
 * plan (landing) con el plan recomendado por la lógica de negocio.
 *
 * - LEGACY / requiresReview → custom_review
 * - recommendedPlan > selectedPlanIntent → suggested_change
 * - sin intención o plan encaja → matches_intent
 */
export function resolveIntakeFitStatus(input: {
  selectedPlanIntent?: SelectedPlanIntent;
  recommendedPlan: DetectedPlan;
  requiresReview: boolean;
}): IntakeFitStatus {
  if (input.requiresReview || input.recommendedPlan === 'LEGACY') {
    return 'custom_review';
  }
  if (!input.selectedPlanIntent) {
    return 'matches_intent';
  }
  const intentRank = PLAN_ORDER[input.selectedPlanIntent];
  const recommendedRank = PLAN_ORDER[input.recommendedPlan];
  if (recommendedRank > intentRank) {
    return 'suggested_change';
  }
  return 'matches_intent';
}

// ─── 4. Review reason codes ───────────────────────────────────

export interface ReviewReasonCodesInput {
  selectedPlanIntent?: SelectedPlanIntent;
  recommendedPlan: DetectedPlan;
  capabilities: NeededCapability[];
  brandAssetsStatus: BrandAssetsStatus;
  photosStatus: PhotosStatus;
  copyStatus: CopyStatus;
  deadlineExpectation: DeadlineExpectation;
}

/**
 * Devuelve un array de códigos legibles por el admin que explican
 * por qué se recomienda revisión o cambio de plan.
 * El orden es relevante: los códigos más importantes van primero.
 */
export function getReviewReasonCodes(
  input: ReviewReasonCodesInput
): string[] {
  const codes: string[] = [];

  // ownership es siempre custom_review, va primero
  if (input.capabilities.includes('ownership')) {
    codes.push('OWNERSHIP_REQUIRES_CUSTOM');
  }

  // plan intent menor al recomendado
  if (
    input.selectedPlanIntent &&
    PLAN_ORDER[input.recommendedPlan] > PLAN_ORDER[input.selectedPlanIntent]
  ) {
    codes.push('PLAN_INTENT_UNDER_SCOPED');
  }

  // materiales faltantes (informativo, no cambia plan)
  if (input.brandAssetsStatus === 'no_clear_brand') {
    codes.push('NO_CLEAR_BRAND');
  }
  if (input.photosStatus !== 'ready') {
    codes.push('MISSING_PHOTOS');
  }
  if (input.copyStatus !== 'ready') {
    codes.push('MISSING_COPY');
  }

  // deadline urgente
  if (
    input.deadlineExpectation === 'asap' ||
    input.deadlineExpectation === 'this_week'
  ) {
    codes.push('FAST_DEADLINE');
  }

  // capacidades que implican plan más alto o revisión
  if (input.capabilities.includes('online_payments')) codes.push('ONLINE_PAYMENTS');
  if (input.capabilities.includes('catalog')) codes.push('CATALOG');
  if (input.capabilities.includes('booking')) codes.push('BOOKING');
  if (input.capabilities.includes('crm_integration')) codes.push('CRM_INTEGRATION');
  if (input.capabilities.includes('multi_service_calendar')) {
    codes.push('MULTI_SERVICE_CALENDAR');
  }

  return codes;
}

// ─── 5. PrimaryGoal[] → plan signals (V2) ────────────────

export function mapPrimaryGoalsToSignals(goals: PrimaryGoal[]): {
  suggestsPlan: DetectedPlan;
  requiresReview: boolean;
  internalSignals: string[];
} {
  const has = (g: PrimaryGoal) => goals.includes(g);
  const signals: string[] = [];

  if (has('full_ownership')) {
    return { suggestsPlan: 'LEGACY', requiresReview: true, internalSignals: ['OWNERSHIP_REQUIRES_CUSTOM'] };
  }
  if (has('orders_sales') || has('online_payments') || has('catalog')) {
    if (has('online_payments')) signals.push('ONLINE_PAYMENTS');
    if (has('catalog')) signals.push('CATALOG');
    if (has('orders_sales')) signals.push('ORDERS_SALES');
    return { suggestsPlan: 'BUSINESS', requiresReview: false, internalSignals: signals };
  }
  if (has('booking')) {
    signals.push('BOOKING');
    return { suggestsPlan: 'PRO', requiresReview: false, internalSignals: signals };
  }
  if (has('content_news')) {
    signals.push('CONTENT_NEWS');
    return { suggestsPlan: 'PRO', requiresReview: false, internalSignals: signals };
  }
  return { suggestsPlan: 'BASIC', requiresReview: false, internalSignals: signals };
}

// ─── 6. PrimaryProblem[] → design signals (V2) ───────────

export function mapPrimaryProblemsToSignals(problems: PrimaryProblem[]): string[] {
  const signals: string[] = [];
  const has = (p: PrimaryProblem) => problems.includes(p);
  if (has('professional_presence')) signals.push('DESIGN_BRANDING');
  if (has('more_contacts')) signals.push('CONVERSION_CONTACTS');
  if (has('organize_services')) signals.push('STRUCTURE_SERVICES');
  if (has('reduce_manual_work')) signals.push('AUTOMATION_REVIEW');
  if (has('replace_existing_site')) signals.push('MIGRATION_RISK');
  if (has('launch_new_business')) signals.push('FULL_ONBOARDING');
  return signals;
}

// ─── 7. V2 materials → internal signals ──────────────────

export function mapMaterialsToSignals(input: {
  copyStatus: CopyStatus;
  photosStatus: PhotosStatus;
  brandIdentityStatus: BrandIdentityStatus;
  domainStatus: DomainStatus;
  hasExistingSite: boolean;
  currentAccessStatus?: CurrentAccessStatus;
}): {
  copyNeeded: boolean;
  visualNeeded: boolean;
  domainNeeded: boolean;
  migrationRisk: boolean;
  internalSignals: string[];
} {
  const signals: string[] = [];
  const copyNeeded = input.copyStatus !== 'ready';
  const visualNeeded = input.photosStatus !== 'ready' || input.brandIdentityStatus === 'no_identity';
  const domainNeeded = input.domainStatus === 'no_domain';
  const migrationRisk = input.hasExistingSite && input.currentAccessStatus === 'no_access';

  if (copyNeeded) signals.push('COPY_NEEDED');
  if (visualNeeded) signals.push('VISUAL_NEEDED');
  if (domainNeeded) signals.push('DOMAIN_NEEDED');
  if (migrationRisk) signals.push('MIGRATION_ACCESS_RISK');

  return { copyNeeded, visualNeeded, domainNeeded, migrationRisk, internalSignals: signals };
}

// ─── 8. Merge deterministic + Groq signals ───────────────

export function mergeSignals(
  deterministicSignals: { suggestsPlan: DetectedPlan; requiresReview: boolean; internalSignals: string[] },
  groqInterpretation: GroqIntakeInterpretation | null
): { finalPlan: DetectedPlan; requiresReview: boolean; allSignals: string[] } {
  const signals = [...deterministicSignals.internalSignals];

  if (deterministicSignals.requiresReview || deterministicSignals.suggestsPlan === 'LEGACY') {
    return {
      finalPlan: deterministicSignals.suggestsPlan,
      requiresReview: deterministicSignals.requiresReview,
      allSignals: signals,
    };
  }

  const PLAN_ORDER_LOCAL: Record<DetectedPlan, number> = { BASIC: 0, PRO: 1, BUSINESS: 2, LEGACY: 3 };
  let finalPlan: DetectedPlan = deterministicSignals.suggestsPlan;

  if (groqInterpretation) {
    if (groqInterpretation.planSignals?.suggestsLegacy) {
      signals.push('GROQ_SUGGESTS_LEGACY_REVIEW');
    }
    const groqPlan: DetectedPlan =
      groqInterpretation.planSignals?.suggestsLegacy ? 'LEGACY' :
      groqInterpretation.planSignals?.suggestsBusiness ? 'BUSINESS' :
      groqInterpretation.planSignals?.suggestsPro ? 'PRO' : 'BASIC';

    if (PLAN_ORDER_LOCAL[groqPlan] > PLAN_ORDER_LOCAL[finalPlan]) {
      finalPlan = groqPlan;
      signals.push('GROQ_UPGRADED_PLAN');
    }
  }

  return { finalPlan, requiresReview: false, allSignals: signals };
}
