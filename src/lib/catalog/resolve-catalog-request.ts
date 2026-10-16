import type {
  CatalogDecision,
  CatalogDecisionCode,
  CatalogNextAction,
  CatalogRequestInput,
  CatalogRequestKind,
} from './types';
import { isReactivationCapabilityVisible } from './types';

const ALLOWED_COMMERCIAL_PROJECT_STATES = new Set([
  'LIVE',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'SUSPENDED',
]);

function makeDecision(
  input: CatalogRequestInput,
  decision: CatalogDecisionCode,
  nextAction: CatalogNextAction,
  reasonCode: string,
  quantities: Partial<Pick<
    CatalogDecision,
    | 'includedQuantity'
    | 'paidQuantity'
    | 'quoteQuantity'
    | 'unavailableQuantity'
    | 'includedRemaining'
    | 'unitPriceCents'
    | 'totalPriceCents'
  >> = {},
  normalizedRequestKind = input.requestKind,
): CatalogDecision {
  const requestedQuantity = Math.max(1, input.quantity);

  return {
    decision,
    nextAction,
    normalizedRequestKind,
    includedQuantity: quantities.includedQuantity ?? 0,
    paidQuantity: quantities.paidQuantity ?? 0,
    quoteQuantity: quantities.quoteQuantity ?? 0,
    unavailableQuantity: quantities.unavailableQuantity ?? 0,
    includedRemaining: quantities.includedRemaining ?? null,
    unitPriceCents: quantities.unitPriceCents ?? null,
    totalPriceCents: quantities.totalPriceCents ?? null,
    listValueCents: input.capability.listPriceCents * requestedQuantity,
    reasonCode,
    snapshot: {
      capabilityCode: input.capability.code,
      projectId: input.project.id,
      plan: input.project.plan,
      projectStatus: input.project.status,
      requestedQuantity,
      requestKind: input.requestKind,
      normalizedRequestKind,
      decision,
      generatedAt: input.now.toISOString(),
    },
  };
}

function isWarrantyActive(input: CatalogRequestInput) {
  return Boolean(
    input.requestKind === 'correction'
    && input.project.postLaunchWarrantyEndsAt
    && input.now <= input.project.postLaunchWarrantyEndsAt,
  );
}

function normalizeRequestKind(input: CatalogRequestInput): CatalogRequestKind {
  if (input.requestKind !== 'correction') return input.requestKind;
  return isWarrantyActive(input) ? 'correction' : 'change';
}

function getUsedIncludedQuantity(input: CatalogRequestInput) {
  return input.usageHistory
    .filter((usage) => usage.decision === 'included_allowance')
    .reduce((total, usage) => total + Math.max(0, usage.quantity), 0);
}

function hasMissingDependency(input: CatalogRequestInput) {
  const dependencies = input.capability.dependencies ?? [];
  return dependencies.some((code) => !input.availableCapabilityCodes.includes(code));
}

function hasConflict(input: CatalogRequestInput) {
  const conflicts = (input.capability.conflicts ?? []).filter(Boolean) as string[];
  return conflicts.some((code) => input.availableCapabilityCodes.includes(code));
}

function fixedPrice(input: CatalogRequestInput, quantity: number) {
  return Math.max(0, input.capability.priceCents ?? 0) * quantity;
}

export function resolveCatalogRequest(input: CatalogRequestInput): CatalogDecision {
  const requestedQuantity = Math.max(1, input.quantity);
  const normalizedRequestKind = normalizeRequestKind(input);

  if (!input.capability.active) {
    return makeDecision(input, 'blocked_disabled', 'blocked', 'capability_disabled');
  }

  if (input.project.status === 'CLOSED') {
    return makeDecision(input, 'blocked_project_closed', 'blocked', 'project_closed');
  }

  // R01 is only valid on SUSPENDED projects — block it everywhere else.
  if (input.capability.code === 'R01' && input.project.status !== 'SUSPENDED') {
    return makeDecision(input, 'blocked_invalid_project_state', 'blocked', 'r01_requires_suspended_project');
  }

  if (input.project.status === 'SUSPENDED') {
    const isR01 = input.capability.code === 'R01';
    const r01Active = isReactivationCapabilityVisible(input.project, input.now);
    if (!isR01) {
      return makeDecision(input, 'blocked_invalid_project_state', 'blocked', 'suspended_commercial_blocked');
    }
    if (!r01Active) {
      return makeDecision(input, 'blocked_invalid_project_state', 'blocked', 'r01_not_yet_active');
    }
  }

  if (!ALLOWED_COMMERCIAL_PROJECT_STATES.has(input.project.status)) {
    return makeDecision(input, 'blocked_invalid_project_state', 'blocked', 'invalid_project_state');
  }

  if (hasMissingDependency(input)) {
    return makeDecision(input, 'blocked_missing_dependency', 'blocked', 'missing_dependency');
  }

  if (hasConflict(input)) {
    return makeDecision(input, 'blocked_conflict', 'blocked', 'capability_conflict');
  }

  if (isWarrantyActive(input)) {
    return makeDecision(
      input,
      'included_warranty',
      'submit_included',
      'post_launch_warranty',
      {
        includedQuantity: requestedQuantity,
        totalPriceCents: 0,
      },
    );
  }

  const rule = input.planRule;

  if (!rule) {
    const noRuleDecision = input.capability.pricingMode === 'included'
      ? 'unavailable'
      : input.capability.pricingMode === 'quote'
        ? 'quote_required'
        : 'paid_addon';

    const nextAction = noRuleDecision === 'quote_required'
      ? 'request_quote'
      : noRuleDecision === 'unavailable'
        ? 'request_admin_review'
        : 'request_payment_after_approval';

    return makeDecision(
      input,
      noRuleDecision,
      nextAction,
      'missing_plan_rule',
      noRuleDecision === 'paid_addon'
        ? {
            paidQuantity: requestedQuantity,
            unitPriceCents: input.capability.priceCents ?? 0,
            totalPriceCents: fixedPrice(input, requestedQuantity),
          }
        : {},
      normalizedRequestKind,
    );
  }

  if (!rule.allowedRequestKinds.includes(normalizedRequestKind)) {
    return makeDecision(
      input,
      'blocked_request_kind',
      'blocked',
      'request_kind_not_allowed',
      {},
      normalizedRequestKind,
    );
  }

  if (input.capability.pricingMode === 'quote' || rule.availability === 'quote') {
    return makeDecision(
      input,
      'quote_required',
      'request_quote',
      'quote_pricing',
      { quoteQuantity: requestedQuantity },
      normalizedRequestKind,
    );
  }

  if (rule.availability === 'unavailable') {
    return makeDecision(
      input,
      'unavailable',
      'request_admin_review',
      'rule_unavailable',
      { unavailableQuantity: requestedQuantity },
      normalizedRequestKind,
    );
  }

  if (rule.availability === 'paid') {
    return makeDecision(
      input,
      'paid_addon',
      'request_payment_after_approval',
      'fixed_paid',
      {
        paidQuantity: requestedQuantity,
        unitPriceCents: input.capability.priceCents ?? 0,
        totalPriceCents: fixedPrice(input, requestedQuantity),
      },
      normalizedRequestKind,
    );
  }

  if (rule.availability === 'included' && !rule.inclusionScope) {
    return makeDecision(
      input,
      'unavailable',
      'request_admin_review',
      'included_without_scope',
      { unavailableQuantity: requestedQuantity },
      normalizedRequestKind,
    );
  }

  if (input.capability.pricingMode === 'included' && rule.availability !== 'included') {
    return makeDecision(
      input,
      'unavailable',
      'request_admin_review',
      'included_without_included_rule',
      { unavailableQuantity: requestedQuantity },
      normalizedRequestKind,
    );
  }

  if (rule.inclusionScope === 'initial_setup') {
    if (input.deliveredCapabilityCodes.includes(input.capability.code)) {
      return makeDecision(
        input,
        'blocked_duplicate',
        'blocked',
        'setup_already_delivered',
        {},
        normalizedRequestKind,
      );
    }

    const includedQuantity = Math.min(requestedQuantity, rule.initialIncludedQty);
    if (includedQuantity <= 0) {
      return makeDecision(
        input,
        'unavailable',
        'request_admin_review',
        'setup_rule_without_quantity',
        { unavailableQuantity: requestedQuantity },
        normalizedRequestKind,
      );
    }

    return makeDecision(
      input,
      'included_setup',
      'submit_included',
      'initial_setup_included',
      {
        includedQuantity,
        unavailableQuantity: requestedQuantity - includedQuantity,
        totalPriceCents: 0,
      },
      normalizedRequestKind,
    );
  }

  if (rule.inclusionScope === 'recurring_allowance') {
    const usedIncludedQuantity = getUsedIncludedQuantity(input);
    const includedRemaining = Math.max(0, rule.recurringIncludedQty - usedIncludedQuantity);
    const includedQuantity = Math.min(requestedQuantity, includedRemaining);
    const overageQuantity = requestedQuantity - includedQuantity;

    if (overageQuantity === 0) {
      return makeDecision(
        input,
        'included_allowance',
        'submit_included',
        'recurring_allowance_available',
        {
          includedQuantity,
          includedRemaining,
          totalPriceCents: 0,
        },
        normalizedRequestKind,
      );
    }

    if (includedQuantity > 0 && rule.overageMode === 'paid') {
      return makeDecision(
        input,
        'partial_available',
        'show_partial_options',
        'recurring_allowance_partial_paid_overage',
        {
          includedQuantity,
          paidQuantity: overageQuantity,
          includedRemaining,
          unitPriceCents: input.capability.priceCents ?? 0,
          totalPriceCents: fixedPrice(input, overageQuantity),
        },
        normalizedRequestKind,
      );
    }

    if (includedQuantity > 0 && rule.overageMode === 'quote') {
      return makeDecision(
        input,
        'partial_available',
        'show_partial_options',
        'recurring_allowance_partial_quote_overage',
        {
          includedQuantity,
          quoteQuantity: overageQuantity,
          includedRemaining,
        },
        normalizedRequestKind,
      );
    }

    if (includedQuantity > 0 && rule.overageMode === 'unavailable') {
      return makeDecision(
        input,
        'partial_available',
        'show_partial_options',
        'recurring_allowance_partial_unavailable_overage',
        {
          includedQuantity,
          unavailableQuantity: overageQuantity,
          includedRemaining,
        },
        normalizedRequestKind,
      );
    }

    if (rule.overageMode === 'paid') {
      return makeDecision(
        input,
        'paid_addon',
        'request_payment_after_approval',
        'recurring_allowance_exhausted_paid_overage',
        {
          paidQuantity: requestedQuantity,
          includedRemaining,
          unitPriceCents: input.capability.priceCents ?? 0,
          totalPriceCents: fixedPrice(input, requestedQuantity),
        },
        normalizedRequestKind,
      );
    }

    if (rule.overageMode === 'quote') {
      return makeDecision(
        input,
        'quote_required',
        'request_quote',
        'recurring_allowance_exhausted_quote_overage',
        {
          quoteQuantity: requestedQuantity,
          includedRemaining,
        },
        normalizedRequestKind,
      );
    }

    return makeDecision(
      input,
      'unavailable',
      'request_admin_review',
      'recurring_allowance_exhausted_unavailable_overage',
      {
        unavailableQuantity: requestedQuantity,
        includedRemaining,
      },
      normalizedRequestKind,
    );
  }

  if (input.capability.pricingMode === 'fixed') {
    return makeDecision(
      input,
      'paid_addon',
      'request_payment_after_approval',
      'fixed_paid_without_inclusion',
      {
        paidQuantity: requestedQuantity,
        unitPriceCents: input.capability.priceCents ?? 0,
        totalPriceCents: fixedPrice(input, requestedQuantity),
      },
      normalizedRequestKind,
    );
  }

  return makeDecision(
    input,
    'unavailable',
    'request_admin_review',
    'included_without_scope',
    { unavailableQuantity: requestedQuantity },
    normalizedRequestKind,
  );
}
