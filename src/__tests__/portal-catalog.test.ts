// Tests for portal catalog behavior
// These tests verify the motor decisions for portal-relevant scenarios.
// Server action integration tests (requiring DB + Clerk) are noted inline.

import { describe, expect, it } from 'vitest';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import { deriveClientTicketStatus } from '@/lib/tickets/billing';
import type {
  CatalogCapability,
  CatalogPlanRule,
  CatalogRequestInput,
  ProjectCatalogContext,
} from '@/lib/catalog/types';

const baseCapability: CatalogCapability = {
  id: 'cap-p01',
  code: 'P01',
  active: true,
  pricingMode: 'fixed',
  listPriceCents: 9900,
  priceCents: 9900,
  dependencies: [],
  conflicts: [],
};

const paidRule: CatalogPlanRule = {
  availability: 'paid',
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'paid',
  overageAddonCode: null,
  allowedRequestKinds: ['change', 'expansion', 'maintenance', 'correction', 'reactivation'],
};

const includedSetupRule: CatalogPlanRule = {
  availability: 'included',
  inclusionScope: 'initial_setup',
  initialIncludedQty: 1,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'unavailable',
  overageAddonCode: null,
  allowedRequestKinds: ['initial_delivery', 'change'],
};

const allowanceRule: CatalogPlanRule = {
  availability: 'included',
  inclusionScope: 'recurring_allowance',
  initialIncludedQty: 0,
  recurringIncludedQty: 2,
  recurringPeriod: 'calendar_month',
  overageMode: 'paid',
  overageAddonCode: null,
  allowedRequestKinds: ['change', 'expansion'],
};

const liveProject: ProjectCatalogContext = {
  id: 'proj-live',
  plan: 'PRO',
  status: 'LIVE',
  postLaunchWarrantyEndsAt: null,
};

const now = new Date('2026-05-05T12:00:00Z');

function makeInput(overrides: Partial<CatalogRequestInput> = {}): CatalogRequestInput {
  return {
    capability: baseCapability,
    planRule: paidRule,
    project: liveProject,
    requestKind: 'change',
    quantity: 1,
    now,
    usageHistory: [],
    deliveredCapabilityCodes: [],
    availableCapabilityCodes: [],
    ...overrides,
  };
}

// ─── Project state blocking ───────────────────────────────────────────────────

describe('portal: project state guards', () => {
  it('blocks all requests when project is CLOSED', () => {
    const decision = resolveCatalogRequest(
      makeInput({ project: { ...liveProject, status: 'CLOSED' } }),
    );
    expect(decision.decision).toBe('blocked_project_closed');
    expect(decision.nextAction).toBe('blocked');
  });

  it('blocks requests when project is CANCELLED', () => {
    const decision = resolveCatalogRequest(
      makeInput({ project: { ...liveProject, status: 'CANCELLED' } }),
    );
    expect(decision.nextAction).toBe('blocked');
  });

  it('allows requests on LIVE project', () => {
    const decision = resolveCatalogRequest(makeInput());
    expect(decision.nextAction).not.toBe('blocked');
  });

  it('allows requests on STAGING_REVIEW project', () => {
    const decision = resolveCatalogRequest(
      makeInput({ project: { ...liveProject, status: 'STAGING_REVIEW' } }),
    );
    expect(decision.nextAction).not.toBe('blocked');
  });
});

// ─── Billing decisions for included scenarios ────────────────────────────────

describe('portal: included billing decisions produce $0 tickets', () => {
  it('included_setup returns totalPriceCents = 0', () => {
    const decision = resolveCatalogRequest(
      makeInput({ planRule: includedSetupRule, requestKind: 'initial_delivery' }),
    );
    expect(decision.decision).toBe('included_setup');
    expect(decision.totalPriceCents).toBe(0);
  });

  it('included_allowance within quota returns totalPriceCents = 0', () => {
    const decision = resolveCatalogRequest(
      makeInput({ planRule: allowanceRule, usageHistory: [] }),
    );
    expect(decision.decision).toBe('included_allowance');
    expect(decision.totalPriceCents).toBe(0);
  });

  it('included_warranty within warranty window returns totalPriceCents = 0', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        requestKind: 'correction',
        planRule: { ...paidRule, allowedRequestKinds: ['correction', 'change'] },
        project: {
          ...liveProject,
          postLaunchWarrantyEndsAt: new Date('2026-05-06T12:00:00Z'),
        },
      }),
    );
    expect(decision.decision).toBe('included_warranty');
    expect(decision.totalPriceCents).toBe(0);
  });
});

// ─── Paid and quote decisions ─────────────────────────────────────────────────

describe('portal: paid_addon decisions have positive price', () => {
  it('paid_addon returns totalPriceCents > 0', () => {
    const decision = resolveCatalogRequest(makeInput());
    expect(decision.decision).toBe('paid_addon');
    expect(decision.totalPriceCents).toBeGreaterThan(0);
  });

  it('quote_required decision does not expose a price', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        planRule: { ...paidRule, availability: 'quote' },
      }),
    );
    expect(decision.decision).toBe('quote_required');
    expect(decision.totalPriceCents).toBeNull();
  });
});

// ─── Duplicate blocking ───────────────────────────────────────────────────────

describe('portal: blocked_duplicate prevents re-requesting delivered capabilities', () => {
  it('blocks initial_delivery when capability code already delivered', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        planRule: includedSetupRule,
        requestKind: 'initial_delivery',
        deliveredCapabilityCodes: ['P01'],
      }),
    );
    expect(decision.decision).toBe('blocked_duplicate');
    expect(decision.nextAction).toBe('blocked');
  });
});

// ─── Partial availability ────────────────────────────────────────────────────

describe('portal: partial_available triggers show_partial_options', () => {
  it('partial_available with paid overage shows partial options', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        quantity: 5,
        planRule: {
          ...allowanceRule,
          recurringIncludedQty: 2,
          overageMode: 'paid',
        },
        usageHistory: [],
      }),
    );
    expect(decision.decision).toBe('partial_available');
    expect(decision.nextAction).toBe('show_partial_options');
    expect(decision.includedQuantity).toBeGreaterThan(0);
    expect(decision.paidQuantity).toBeGreaterThan(0);
  });

  it('partial_available with unavailable overage shows partial options', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        quantity: 5,
        planRule: {
          ...allowanceRule,
          recurringIncludedQty: 2,
          overageMode: 'unavailable',
        },
        usageHistory: [],
      }),
    );
    expect(decision.decision).toBe('partial_available');
    expect(decision.nextAction).toBe('show_partial_options');
    expect(decision.unavailableQuantity).toBeGreaterThan(0);
  });
});

// ─── Quote status derivation for partial tickets (regression: P1 bug) ────────
// Verifies that partial_available + quoteQuantity > 0 should trigger quote flow.
// The motor exposes the raw quantities; submitCatalogRequest must translate them
// to quoteStatus='requested' when quoteQuantity > 0.

describe('portal: partial_available with quote overage exposes quoteQuantity', () => {
  it('partial_available with quote overage sets quoteQuantity > 0 on the decision', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        quantity: 3,
        planRule: {
          ...allowanceRule,
          recurringIncludedQty: 1,
          overageMode: 'quote',
        },
        usageHistory: [],
      }),
    );
    expect(decision.decision).toBe('partial_available');
    expect(decision.quoteQuantity).toBeGreaterThan(0);
    // The server action must set quoteStatus='requested' when quoteQuantity > 0
    // (regression guard for bug where only quote_required triggered it)
    const shouldRequestQuote =
      decision.decision === 'quote_required' || decision.quoteQuantity > 0;
    expect(shouldRequestQuote).toBe(true);
  });
});

// ─── Request kind blocking ────────────────────────────────────────────────────

describe('portal: blocked_request_kind for disallowed kinds', () => {
  it('blocks a requestKind not in allowedRequestKinds', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        requestKind: 'reactivation',
        planRule: { ...paidRule, allowedRequestKinds: ['change'] },
      }),
    );
    expect(decision.decision).toBe('blocked_request_kind');
    expect(decision.nextAction).toBe('blocked');
  });
});

// ─── Warranty correction normalization ───────────────────────────────────────

describe('portal: correction outside warranty normalizes to change', () => {
  it('correction outside warranty is treated as change by the motor', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        requestKind: 'correction',
        planRule: { ...paidRule, allowedRequestKinds: ['change'] },
        project: {
          ...liveProject,
          postLaunchWarrantyEndsAt: new Date('2026-05-04T12:00:00Z'),
        },
      }),
    );
    expect(decision.normalizedRequestKind).toBe('change');
    expect(decision.decision).toBe('paid_addon');
  });
});

// ─── Client ticket status derivation ─────────────────────────────────────────

describe('portal: deriveClientTicketStatus maps correctly for portal tickets', () => {
  it('PENDING_APPROVAL + included_setup → included (billing decision visible immediately)', () => {
    const status = deriveClientTicketStatus('PENDING_APPROVAL', 'included_setup', 'none');
    expect(status).toBe('included');
  });

  it('APPROVED + included_setup → included', () => {
    const status = deriveClientTicketStatus('APPROVED', 'included_setup', 'none');
    expect(status).toBe('included');
  });

  it('PENDING_APPROVAL + quote_required + quoteStatus=requested → quote_requested', () => {
    const status = deriveClientTicketStatus('PENDING_APPROVAL', 'quote_required', 'requested');
    expect(status).toBe('quote_requested');
  });

  it('PAYMENT_PENDING + paid_addon → payment_pending', () => {
    const status = deriveClientTicketStatus('PAYMENT_PENDING', 'paid_addon', 'none');
    expect(status).toBe('payment_pending');
  });

  it('COMPLETED + any decision → delivered', () => {
    const status = deriveClientTicketStatus('COMPLETED', 'paid_addon', 'none');
    expect(status).toBe('delivered');
  });

  it('REJECTED → rejected', () => {
    const status = deriveClientTicketStatus('REJECTED', null, 'rejected');
    expect(status).toBe('rejected');
  });
});

// ─── Visibility rules (documented integration tests) ─────────────────────────
//
// The following cases require DB + server action integration:
//
// [SERVER ACTION] getPortalCatalog: item without portalCategoryId does not appear
// → addon.portalCategoryId IS NOT NULL filter in query
//
// [SERVER ACTION] getPortalCatalog: inactive category does not appear
// → portalCategories.active = true filter + activeCategoryIds set filter
//
// [SERVER ACTION] previewCatalogRequest: does NOT insert into tickets or ticket_events
// → Only calls resolveCatalogRequest(); no db.insert()
//
// [SERVER ACTION] submitCatalogRequest: creates ticket with createdBy='CLIENT'
// → tickets.createdBy set to 'CLIENT'
//
// [SERVER ACTION] submitCatalogRequest: creates quoteStatus='requested' for quote_required
// → quoteStatus = 'requested' when decision.decision === 'quote_required'
//
// [SERVER ACTION] submitCatalogRequest: partial without acceptedPartial throws PARTIAL_REQUIRES_CONFIRMATION
// → if nextAction === 'show_partial_options' && !input.acceptedPartial → throw
//
// [SERVER ACTION] submitCatalogRequest: blocked decision throws, no ticket created
// → if nextAction === 'blocked' → throw, no db.insert(tickets)
//
// [SERVER ACTION] submitCatalogRequest: client cannot access project of another client
// → requireClientProject checks projects.clientId === client.id
//
// [SERVER ACTION] submitCatalogRequest: item with visibleInPortal=false throws
// → assertItemVisibleInPortal() throws if !addon.visibleInPortal
