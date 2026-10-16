import type { ProjectStatus } from '@/lib/projects/state-machine';

// Disabled capabilities are represented by CatalogCapability.active === false.
export type CatalogPricingMode = 'included' | 'fixed' | 'quote';
export type CatalogAvailability = 'included' | 'paid' | 'quote' | 'unavailable';
export type CatalogInclusionScope = 'initial_setup' | 'recurring_allowance';
export type CatalogRecurringPeriod = 'calendar_month';
export type CatalogOverageMode = 'paid' | 'quote' | 'unavailable';
export type CatalogRequestKind =
  | 'initial_delivery'
  | 'change'
  | 'correction'
  | 'expansion'
  | 'maintenance'
  | 'reactivation';

export type CatalogDecisionCode =
  | 'blocked_disabled'
  | 'blocked_project_closed'
  | 'blocked_invalid_project_state'
  | 'blocked_missing_dependency'
  | 'blocked_conflict'
  | 'blocked_request_kind'
  | 'blocked_duplicate'
  | 'included_setup'
  | 'included_warranty'
  | 'included_allowance'
  | 'paid_addon'
  | 'quote_required'
  | 'partial_available'
  | 'unavailable';

export type CatalogNextAction =
  | 'none'
  | 'submit_included'
  | 'request_admin_review'
  | 'request_quote'
  | 'request_payment_after_approval'
  | 'show_partial_options'
  | 'blocked';

export type SubscriptionPlan = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';

export interface CatalogCapability {
  id: string;
  code: string;
  active: boolean;
  pricingMode: CatalogPricingMode;
  listPriceCents: number;
  priceCents: number | null;
  dependencies: string[] | null;
  conflicts: Array<string | null> | null;
}

export interface CatalogPlanRule {
  availability: CatalogAvailability;
  inclusionScope: CatalogInclusionScope | null;
  initialIncludedQty: number;
  recurringIncludedQty: number;
  recurringPeriod: CatalogRecurringPeriod | null;
  overageMode: CatalogOverageMode;
  overageAddonCode: string | null;
  allowedRequestKinds: CatalogRequestKind[];
}

export interface ProjectCatalogContext {
  id: string;
  plan: SubscriptionPlan;
  status: ProjectStatus;
  postLaunchWarrantyEndsAt: Date | null;
  paymentGracePeriodUntil?: Date | null;
  suspendedAt?: Date | null;
  reactivationFeeActive?: boolean;
}

/**
 * R01 rule: visible/chargeable only when SUSPENDED + day 15+ of payment failure.
 * Grace period = days 1–3 (project still LIVE). Inngest suspends on day 4 (sets suspendedAt).
 * Day 15 from failure = day 11 from suspendedAt → threshold is 11 days.
 * Days 4–14 (suspended days 0–10): R01 blocked — client must settle billing.
 * Day 15+ (suspended day 11+): R01 active.
 * OR when reactivationFeeActive flag is explicitly set by admin.
 */
export function isReactivationCapabilityVisible(
  project: Pick<ProjectCatalogContext, 'status' | 'suspendedAt' | 'reactivationFeeActive'>,
  now: Date,
): boolean {
  if (project.status !== 'SUSPENDED') return false;
  if (project.reactivationFeeActive === true) return true;
  if (!project.suspendedAt) return false;
  const MS_PER_DAY = 86_400_000;
  const daysSuspended = (now.getTime() - project.suspendedAt.getTime()) / MS_PER_DAY;
  return daysSuspended >= 11;
}

export interface CatalogUsageRecord {
  quantity: number;
  decision: CatalogDecisionCode;
  occurredAt: Date;
}

export interface CatalogRequestInput {
  capability: CatalogCapability;
  planRule: CatalogPlanRule | null;
  project: ProjectCatalogContext;
  requestKind: CatalogRequestKind;
  quantity: number;
  now: Date;
  usageHistory: CatalogUsageRecord[];
  deliveredCapabilityCodes: string[];
  availableCapabilityCodes: string[];
}

export interface CatalogDecision {
  decision: CatalogDecisionCode;
  nextAction: CatalogNextAction;
  normalizedRequestKind: CatalogRequestKind;
  includedQuantity: number;
  paidQuantity: number;
  quoteQuantity: number;
  unavailableQuantity: number;
  includedRemaining: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  listValueCents: number;
  reasonCode: string;
  snapshot: {
    capabilityCode: string;
    projectId: string;
    plan: SubscriptionPlan;
    projectStatus: ProjectStatus;
    requestedQuantity: number;
    requestKind: CatalogRequestKind;
    normalizedRequestKind: CatalogRequestKind;
    decision: CatalogDecisionCode;
    generatedAt: string;
  };
}

// ─── Loader, Calculadora, Intake, Propuestas ─────

/** Normalized catalog entry as returned by the loader. */
export interface CatalogEntry {
  id: string;
  code: string;
  name: string;
  publicName: string;
  category: string;
  source: string;
  pricingMode: CatalogPricingMode;
  priceCents: number;
  listPriceCents: number;
  active: boolean;
  visibleInCalculator: boolean;
  visibleInProposals: boolean;
  planRules: Partial<Record<SubscriptionPlan, CatalogPlanRule>>;
  adminNotes?: string | null;
}

// ─── Calculator types ─────────────────────────────────────

export interface CatalogCalculatorItem {
  catalogItemId: string;
  code: string;
  name: string;
  category: string;
  source: string;
  pricingMode: CatalogPricingMode;
  availability: CatalogAvailability | null;
  priceCents: number | null;
  listPriceCents: number;
  reason: string;
}

export interface CalculatorCatalogResult {
  included: CatalogCalculatorItem[];
  paid: CatalogCalculatorItem[];
  quoteRequired: CatalogCalculatorItem[];
  unavailable: CatalogCalculatorItem[];
  totals: {
    paidAddOnsCents: number;
    includedValueCents: number;
    quoteCount: number;
  };
}

// ─── Intake types ─────────────────────────────────────────

export interface IntakeCatalogSuggestion {
  catalogItemCode: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  bucket: 'included' | 'recommended_addon' | 'quote_required';
}

// ─── Proposal / Snapshot types ────────────────────────────

export interface SnapshotCapability {
  catalogItemId: string;
  code: string;
  name: string;
  publicName: string;
  source: string;
  category: string;
  pricingMode: string;
  availability: string | null;
  inclusionScope: string | null;
  priceCents: number | null;
  listPriceCents: number;
  reason: string;
}

export interface ProposalCatalogSnapshot {
  generatedAt: string;         // ISO
  plan: SubscriptionPlan;
  included: SnapshotCapability[];
  recommendedAddOns: SnapshotCapability[];
  quoteRequired: SnapshotCapability[];
}
