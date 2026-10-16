// ============================================================
// Intake Types — WaaS
// ============================================================

import type { Niche } from '@/lib/calculadora/types';

// ─── Material status ──────────────────────────────────────
export type MaterialStatus =
  | 'tiene_todo'
  | 'tiene_logo_no_fotos'
  | 'no_tiene_nada';

// ─── Checklist de funcionalidades (Módulo 2) ─────────────
export interface FeatureChecklist {
  needsBooking: boolean;        // Plan PRO
  needsCatalog: boolean;        // Plan BUSINESS
  needsCheckout: boolean;       // Plan BUSINESS
  needsBlog: boolean;           // Add-on C02A/C02B (NO sube plan)
  wantsOwnership: boolean;      // Plan LEGACY → requiresReview
  needsCrmIntegration: boolean; // Add-on I01 (NO sube plan)
  needsMultiEmployeeCalendar: boolean; // Add-on I02 (NO sube plan)
}

// ─── Add-ons sugeridos ────────────────────────────────────
export type AddOnKey =
  | 'C01_copywriting'        // $149 — "No tengo nada"
  | 'C02_blog_engine'        // $129 — needsBlog
  | 'I01_crm_sync'           // $99  — needsCrmIntegration
  | 'I02_advanced_booking';  // $129 — needsMultiEmployeeCalendar

export interface AddOnSuggestion {
  key: AddOnKey;
  label: string;
  priceUsd: number;
  reason: string; // Por qué se sugiere (texto legible para el cliente)
}

// ─── Plan detectado ───────────────────────────────────────
export type DetectedPlan = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';

export interface PlanDetectionResult {
  plan: DetectedPlan;
  reasons: string[];        // Explicación legible → ProposalPreviewCard
  requiresReview: boolean;  // true = ruta LEGACY → sin botón de pago
  suggestedAddOns: AddOnSuggestion[];
}

// ─── Datos del formulario completo (M1 + M2) ─────────────
export interface IntakeFormData {
  // Step 1 — Contacto
  fullName: string;
  email: string;
  whatsapp: string;
  businessName: string;

  // Step 2 — Contexto
  industry: Niche;
  location: string;
  currentUrl?: string;
  materialStatus: MaterialStatus;
  referenceUrls?: string; // URLs de inspiración (textarea)

  // Step 3 — Funcionalidades
  features: FeatureChecklist;
  freeformBrief?: string; // Brief libre del checklist (indica complejidad)

  // Metadata del wizard
  detectedPlan: PlanDetectionResult;
  submittedAt?: string; // ISO date
}

// ─── Estado de draft en localStorage ─────────────────────
export interface IntakeDraft {
  version: 'v1';
  step: number;
  data: Partial<IntakeFormData>;
  savedAt: string; // ISO date
}

export const INTAKE_DRAFT_KEY = 'waas_intake_draft';
export const INTAKE_DRAFT_TTL_HOURS = 48;

// ============================================================
// Intake V2 Types — Wizard Comercial V2
// Conviven con los tipos legacy sin romperlos.
// ============================================================

// ─── Modo y fuente de entrada ─────────────────────────────
export type IntakeMode = 'commercial' | 'profile';

export type IntakeSource =
  | 'pricing'
  | 'header'
  | 'direct'
  | 'portal_activation'
  | 'referral';

// ─── Plan intent (lo que el usuario eligió en landing) ────
// IMPORTANTE: esto es intención, NO plan aprobado ni pagado.
export type SelectedPlanIntent = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY' | null;

// ─── Problemas principales (Paso 2 V2 — multiselect) ─────
export type PrimaryProblem =
  | 'professional_presence'
  | 'more_contacts'
  | 'organize_services'
  | 'reduce_manual_work'
  | 'replace_existing_site'
  | 'launch_new_business'
  | 'other';

// ─── Objetivos del negocio (Paso 3 V2 — multiselect) ─────
export type PrimaryGoal =
  | 'contacts'
  | 'services_brand'
  | 'booking'
  | 'catalog'
  | 'orders_sales'
  | 'online_payments'
  | 'content_news'
  | 'full_ownership';

// ─── Capacidades necesarias (Paso 2 V2) ──────────────────
export type NeededCapability =
  | 'contact_requests'
  | 'booking'
  | 'catalog'
  | 'online_payments'
  | 'blog'
  | 'crm_integration'
  | 'multi_service_calendar'
  | 'ownership';

// ─── Estado de materiales V2 (Paso 3 V2) ─────────────────
export type BrandAssetsStatus =
  | 'has_logo'
  | 'has_logo_and_brand'
  | 'no_clear_brand';

export type BrandIdentityStatus =
  | 'has_logo_and_style'
  | 'has_logo_no_style'
  | 'no_identity';

export type PhotosStatus =
  | 'ready'
  | 'needs_stock'
  | 'needs_help';

export type CopyStatus =
  | 'ready'
  | 'ideas_only'
  | 'needs_help';

export type DeadlineExpectation =
  | 'asap'
  | 'this_week'
  | 'this_month'
  | 'no_rush';

export type DomainStatus = 'has_domain' | 'no_domain' | 'not_sure';

export type CurrentAccessStatus = 'has_access' | 'no_access' | 'not_sure';

// ─── Fit status del wizard (Paso 5 V2) ───────────────────
export type IntakeFitStatus =
  | 'matches_intent'
  | 'suggested_change'
  | 'custom_review';

// ─── Interpretación de Groq (salida estructurada del brief libre) ─
export interface GroqIntakeInterpretation {
  inferredIndustry?: string;
  detectedNeeds: string[];
  scopeRisks: string[];
  planSignals: {
    suggestsLegacy: boolean;
    suggestsBusiness: boolean;
    suggestsPro: boolean;
  };
  needsCopy: boolean;
  needsVisuals: boolean;
  needsBooking: boolean;
  needsCatalog: boolean;
  needsPayments: boolean;
  needsContent: boolean;
  questionsForAdmin: string[];
  humanSummary: string;
}

// ─── Interfaces por paso (para composición) ──

export interface IntakeV2ScopeData {
  firstName: string;
  lastName: string;
  businessName: string;
  industry: string;
  whatYouOffer: string;
  hasExistingSite: boolean;
  currentUrl?: string;
  primaryProblems: PrimaryProblem[];
  primaryProblemsOther?: string;
  primaryGoals: PrimaryGoal[];
  neededCapabilities?: NeededCapability[];
}

export interface IntakeV2MaterialsData {
  brandIdentityStatus: BrandIdentityStatus;
  photosStatus: PhotosStatus;
  copyStatus: CopyStatus;
  domainStatus: DomainStatus;
  currentAccessStatus?: CurrentAccessStatus;
  groqInterpretation?: GroqIntakeInterpretation;
}

export interface IntakeV2ContactData {
  email: string;
  whatsapp: string;
  reviewConsent: boolean;
  authUserId?: string;
  authRequiredBeforeSubmit?: boolean;
}

export interface IntakeV2Metadata {
  selectedPlanIntent?: SelectedPlanIntent;
  source?: IntakeSource;
  mode?: IntakeMode;
  recommendedPlan?: DetectedPlan;
  fitStatus?: IntakeFitStatus;
  reviewReasonCodes?: string[];
  submittedAt?: string;
}

// ─── Formulario V2 completo (M1+M2+M3+M4 V2) ─────────────
// Convive con IntakeFormData (legacy). El servidor acepta ambos.
export interface IntakeFormDataV2
  extends IntakeV2ScopeData,
    IntakeV2MaterialsData,
    IntakeV2ContactData,
    IntakeV2Metadata {}

// ─── Tipo plano listo para envío V2 ──────────────────────
export type IntakeFormDataV2Final = IntakeFormDataV2 & {
  freeformBrief: string;
};

// ─── Draft V2 en localStorage ─────────────────────────────
export interface IntakeDraftV2 {
  version: 'v2';
  step: number;
  data: Partial<IntakeFormDataV2Final>;
  savedAt: string;
}
