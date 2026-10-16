import { describe, expect, it } from 'vitest';
import {
  shouldSuspendAfterGrace,
  buildGracePeriodFields,
  buildSuspendFields,
  buildManualSuspendFields,
  buildReactivationFields,
  buildPaymentSuccessGraceClearFields,
  isRecurringPaymentSuccessEvent,
  extractPayPalSubscriptionId,
} from '@/lib/projects/payment-lifecycle';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import { isReactivationCapabilityVisible } from '@/lib/catalog/types';
import type {
  CatalogCapability,
  CatalogPlanRule,
  CatalogRequestInput,
  ProjectCatalogContext,
} from '@/lib/catalog/types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const DAY = 86_400_000;
const NOW = new Date('2026-05-29T12:00:00Z');

const r01Capability: CatalogCapability = {
  id: 'cap-r01',
  code: 'R01',
  active: true,
  pricingMode: 'fixed',
  listPriceCents: 2500,
  priceCents: 2500,
  dependencies: [],
  conflicts: [],
};

const r01Rule: CatalogPlanRule = {
  availability: 'paid',
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'paid',
  overageAddonCode: null,
  allowedRequestKinds: ['reactivation'],
};

const d01Capability: CatalogCapability = {
  id: 'cap-d01',
  code: 'D01',
  active: true,
  pricingMode: 'fixed',
  listPriceCents: 5900,
  priceCents: 5900,
  dependencies: [],
  conflicts: [],
};

const d01Rule: CatalogPlanRule = {
  availability: 'paid',
  inclusionScope: null,
  initialIncludedQty: 0,
  recurringIncludedQty: 0,
  recurringPeriod: null,
  overageMode: 'paid',
  overageAddonCode: null,
  allowedRequestKinds: ['change'],
};

const baseLiveProject: ProjectCatalogContext = {
  id: 'project-1',
  plan: 'PRO',
  status: 'LIVE',
  postLaunchWarrantyEndsAt: null,
  suspendedAt: null,
  reactivationFeeActive: false,
};

function makeInput(overrides: Partial<CatalogRequestInput> = {}): CatalogRequestInput {
  return {
    capability: d01Capability,
    planRule: d01Rule,
    project: baseLiveProject,
    requestKind: 'change',
    quantity: 1,
    now: NOW,
    usageHistory: [],
    deliveredCapabilityCodes: [],
    availableCapabilityCodes: ['D01'],
    ...overrides,
  };
}

// ─── R01 catalog resolver tests ───────────────────────────────────────────────

describe('R01 — catalog resolver (suspensión/reactivación)', () => {
  it('bloquea R01 en proyecto LIVE (r01_requires_suspended_project)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: { ...baseLiveProject, status: 'LIVE' },
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_requires_suspended_project');
  });

  it('bloquea R01 en proyecto SUSPENDED en día 10 de suspensión — equivale a día 14 desde fallo (r01_not_yet_active)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(NOW.getTime() - 10 * DAY),
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });

  it('permite R01 como paid_addon en proyecto SUSPENDED en día 11 de suspensión — equivale a día 15 desde fallo (umbral comercial)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(NOW.getTime() - 11 * DAY),
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    expect(decision.decision).toBe('paid_addon');
    expect(decision.reasonCode).toBe('fixed_paid');
  });

  it('permite R01 inmediatamente cuando reactivationFeeActive=true (override admin)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(NOW.getTime() - 1 * DAY),
        reactivationFeeActive: true,
      },
      now: NOW,
    }));
    expect(decision.decision).toBe('paid_addon');
  });

  it('bloquea capacidades comerciales no-R01 en proyecto SUSPENDED (suspended_commercial_blocked)', () => {
    const decision = resolveCatalogRequest(makeInput({
      capability: d01Capability,
      planRule: d01Rule,
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt: new Date(NOW.getTime() - 5 * DAY),
        reactivationFeeActive: false,
      },
    }));
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('suspended_commercial_blocked');
  });
});

// ─── isReactivationCapabilityVisible ─────────────────────────────────────────

describe('isReactivationCapabilityVisible — umbrales de días', () => {
  it('retorna false cuando el proyecto no está SUSPENDED', () => {
    expect(
      isReactivationCapabilityVisible({ status: 'LIVE', suspendedAt: null, reactivationFeeActive: false }, NOW)
    ).toBe(false);
  });

  it('retorna false cuando SUSPENDED pero suspendedAt es null', () => {
    expect(
      isReactivationCapabilityVisible({ status: 'SUSPENDED', suspendedAt: null, reactivationFeeActive: false }, NOW)
    ).toBe(false);
  });

  it('retorna false en día 10 de suspensión — equivale a día 14 desde fallo (umbral no alcanzado)', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(NOW.getTime() - 10 * DAY), reactivationFeeActive: false },
        NOW
      )
    ).toBe(false);
  });

  it('retorna true en día 11 de suspensión (día 15 desde el fallo = umbral comercial)', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(NOW.getTime() - 11 * DAY), reactivationFeeActive: false },
        NOW
      )
    ).toBe(true);
  });

  it('retorna true cuando reactivationFeeActive=true independientemente de los días', () => {
    expect(
      isReactivationCapabilityVisible(
        { status: 'SUSPENDED', suspendedAt: new Date(NOW.getTime() - 1 * DAY), reactivationFeeActive: true },
        NOW
      )
    ).toBe(true);
  });
});

// ─── shouldSuspendAfterGrace — lógica del job Inngest ────────────────────────

describe('shouldSuspendAfterGrace — job Inngest decide si suspender', () => {
  it('retorna true cuando el proyecto está LIVE y tiene gracia activa', () => {
    expect(
      shouldSuspendAfterGrace({
        status: 'LIVE',
        paymentGracePeriodUntil: new Date(NOW.getTime() + DAY),
      })
    ).toBe(true);
  });

  it('retorna false cuando paymentGracePeriodUntil es null (pago regularizado)', () => {
    expect(
      shouldSuspendAfterGrace({
        status: 'LIVE',
        paymentGracePeriodUntil: null,
      })
    ).toBe(false);
  });

  it('retorna false cuando el proyecto ya está SUSPENDED', () => {
    expect(
      shouldSuspendAfterGrace({
        status: 'SUSPENDED',
        paymentGracePeriodUntil: new Date(NOW.getTime() + DAY),
      })
    ).toBe(false);
  });

  it('retorna false cuando el proyecto está CANCELLED', () => {
    expect(
      shouldSuspendAfterGrace({
        status: 'CANCELLED',
        paymentGracePeriodUntil: new Date(NOW.getTime() + DAY),
      })
    ).toBe(false);
  });

  it('retorna false cuando el proyecto está CLOSED', () => {
    expect(
      shouldSuspendAfterGrace({
        status: 'CLOSED',
        paymentGracePeriodUntil: new Date(NOW.getTime() + DAY),
      })
    ).toBe(false);
  });
});

// ─── buildGracePeriodFields ───────────────────────────────────────────────────

describe('buildGracePeriodFields — fallo de pago registra gracia sin suspender', () => {
  it('setea paymentGracePeriodUntil a now + 3 días', () => {
    const fields = buildGracePeriodFields(NOW);
    const expectedUntil = new Date(NOW.getTime() + 3 * DAY);
    expect(fields.paymentGracePeriodUntil.getTime()).toBe(expectedUntil.getTime());
    expect(fields.updatedAt).toBe(NOW);
  });

  it('no incluye status ni suspendedAt — proyecto permanece en estado actual', () => {
    const fields = buildGracePeriodFields(NOW);
    expect('status' in fields).toBe(false);
    expect('suspendedAt' in fields).toBe(false);
  });
});

// ─── buildPaymentSuccessGraceClearFields ──────────────────────────────────────

describe('buildPaymentSuccessGraceClearFields — pago exitoso limpia gracia', () => {
  it('setea paymentGracePeriodUntil a null', () => {
    const fields = buildPaymentSuccessGraceClearFields(NOW);
    expect(fields.paymentGracePeriodUntil).toBeNull();
  });

  it('no incluye status — el proyecto permanece LIVE', () => {
    const fields = buildPaymentSuccessGraceClearFields(NOW);
    expect('status' in fields).toBe(false);
    expect('suspendedAt' in fields).toBe(false);
  });

  it('job no suspendería si grace fue limpiada (integración con shouldSuspendAfterGrace)', () => {
    // Simula: fallo de pago → gracia → pago regularizado → job despierta
    const afterClearGrace = buildPaymentSuccessGraceClearFields(NOW);

    const shouldSuspend = shouldSuspendAfterGrace({
      status: 'LIVE',
      paymentGracePeriodUntil: afterClearGrace.paymentGracePeriodUntil,
    });

    expect(shouldSuspend).toBe(false);
  });
});

// ─── buildSuspendFields ───────────────────────────────────────────────────────

describe('buildSuspendFields — suspensión automática (Inngest)', () => {
  it('setea status SUSPENDED, suspendedAt y limpia paymentGracePeriodUntil', () => {
    const fields = buildSuspendFields(NOW);
    expect(fields.status).toBe('SUSPENDED');
    expect(fields.suspendedAt).toBe(NOW);
    expect(fields.paymentGracePeriodUntil).toBeNull();
    expect(fields.updatedAt).toBe(NOW);
  });
});

// ─── buildManualSuspendFields ─────────────────────────────────────────────────

describe('buildManualSuspendFields — suspensión manual por admin', () => {
  it('setea status SUSPENDED, suspendedAt, limpia gracia y deja reactivationFeeActive=false', () => {
    const fields = buildManualSuspendFields(NOW);
    expect(fields.status).toBe('SUSPENDED');
    expect(fields.suspendedAt).toBe(NOW);
    expect(fields.paymentGracePeriodUntil).toBeNull();
    expect(fields.reactivationFeeActive).toBe(false);
    expect(fields.updatedAt).toBe(NOW);
  });
});

// ─── buildReactivationFields ──────────────────────────────────────────────────

describe('buildReactivationFields — reactivación manual/admin', () => {
  it('limpia suspendedAt, paymentGracePeriodUntil y reactivationFeeActive', () => {
    const fields = buildReactivationFields(NOW);
    expect(fields.status).toBe('LIVE');
    expect(fields.suspendedAt).toBeNull();
    expect(fields.paymentGracePeriodUntil).toBeNull();
    expect(fields.reactivationFeeActive).toBe(false);
    expect(fields.updatedAt).toBe(NOW);
  });
});

// ─── isRecurringPaymentSuccessEvent ──────────────────────────────────────────

describe('isRecurringPaymentSuccessEvent — detección de evento de pago recurrente exitoso', () => {
  it('retorna true para BILLING.SUBSCRIPTION.PAYMENT.COMPLETED', () => {
    expect(isRecurringPaymentSuccessEvent('BILLING.SUBSCRIPTION.PAYMENT.COMPLETED')).toBe(true);
  });

  it('retorna true para PAYMENT.SALE.COMPLETED (Billing Agreements API legacy)', () => {
    expect(isRecurringPaymentSuccessEvent('PAYMENT.SALE.COMPLETED')).toBe(true);
  });

  it('retorna false para PAYMENT.CAPTURE.COMPLETED (setup fee / tickets — no aplica)', () => {
    expect(isRecurringPaymentSuccessEvent('PAYMENT.CAPTURE.COMPLETED')).toBe(false);
  });

  it('retorna false para BILLING.SUBSCRIPTION.PAYMENT.FAILED', () => {
    expect(isRecurringPaymentSuccessEvent('BILLING.SUBSCRIPTION.PAYMENT.FAILED')).toBe(false);
  });

  it('retorna false para BILLING.SUBSCRIPTION.CANCELLED', () => {
    expect(isRecurringPaymentSuccessEvent('BILLING.SUBSCRIPTION.CANCELLED')).toBe(false);
  });
});

// ─── extractPayPalSubscriptionId ─────────────────────────────────────────────

describe('extractPayPalSubscriptionId — extrae subscriptionId del payload', () => {
  // Test 1: BILLING.SUBSCRIPTION.PAYMENT.COMPLETED limpia gracia cuando encuentra proyecto
  it('BILLING.SUBSCRIPTION.PAYMENT.COMPLETED extrae resource.id como subscriptionId', () => {
    const result = extractPayPalSubscriptionId(
      'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED',
      { id: 'I-SUB-ABC123', status: 'ACTIVE' }
    );
    expect(result).toBe('I-SUB-ABC123');
  });

  // Test 2: PAYMENT.SALE.COMPLETED extrae billing_agreement_id si está presente
  it('PAYMENT.SALE.COMPLETED extrae resource.billing_agreement_id como subscriptionId', () => {
    const result = extractPayPalSubscriptionId(
      'PAYMENT.SALE.COMPLETED',
      { id: 'SALE-999', billing_agreement_id: 'I-BA-XYZ789', amount: { total: '29.00' } }
    );
    expect(result).toBe('I-BA-XYZ789');
  });

  // Test 3: Evento exitoso sin subscription id resoluble → no-op (retorna null)
  it('PAYMENT.SALE.COMPLETED sin billing_agreement_id retorna null — no debe hacer update', () => {
    const result = extractPayPalSubscriptionId(
      'PAYMENT.SALE.COMPLETED',
      { id: 'SALE-999', amount: { total: '29.00' } }
    );
    expect(result).toBeNull();
  });

  it('PAYMENT.SALE.COMPLETED con billing_agreement_id vacío retorna null', () => {
    const result = extractPayPalSubscriptionId(
      'PAYMENT.SALE.COMPLETED',
      { id: 'SALE-999', billing_agreement_id: '' }
    );
    expect(result).toBeNull();
  });

  it('BILLING.SUBSCRIPTION.PAYMENT.COMPLETED con resource.id ausente retorna null', () => {
    const result = extractPayPalSubscriptionId(
      'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED',
      { status: 'ACTIVE' }
    );
    expect(result).toBeNull();
  });

  // Test 4 (indirecto): subscriptionId con proyecto sin registro no debe fallar
  // (la lógica DB es en route.ts; aquí validamos que el helper sí devuelve el id)
  it('devuelve subscriptionId válido aunque no exista proyecto — route.ts hace no-op al no encontrar registro', () => {
    const result = extractPayPalSubscriptionId(
      'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED',
      { id: 'I-NONEXISTENT-SUB' }
    );
    expect(result).toBe('I-NONEXISTENT-SUB');
  });

  // Test 5: subscriptionId resuelto pero proyecto sin gracia activa — buildPaymentSuccessGraceClearFields no cambia status
  it('buildPaymentSuccessGraceClearFields no cambia status cuando proyecto ya no tiene gracia', () => {
    const fields = buildPaymentSuccessGraceClearFields(NOW);
    // La gracia ya estaba null — setear null de nuevo es no-op semántico
    expect(fields.paymentGracePeriodUntil).toBeNull();
    expect('status' in fields).toBe(false);
    expect('suspendedAt' in fields).toBe(false);
  });

  it('evento tipo PAYMENT.CAPTURE.COMPLETED retorna null — no debe limpiar gracia de suscripción', () => {
    const result = extractPayPalSubscriptionId(
      'PAYMENT.CAPTURE.COMPLETED',
      { id: 'CAP-123' }
    );
    expect(result).toBeNull();
  });
});

// ─── Timeline oficial: día 15 desde fallo / día 11 desde suspensión ──────────

describe('Timeline R01 — día 15 desde fallo = día 11 desde suspensión', () => {
  // Test 6: R01 día 10 desde suspensión sigue bloqueado (= día 14 desde fallo)
  it('día 10 desde suspensión (= día 14 desde fallo): R01 bloqueado, isReactivationCapabilityVisible=false', () => {
    const suspendedAt = new Date(NOW.getTime() - 10 * DAY);
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt,
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    // Día 10 < 11 → bloqueado. R01 NO se cobra antes del día 15 total desde fallo.
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });

  // Test 7: R01 día 11 desde suspensión permitido (= día 15 desde fallo)
  it('día 11 desde suspensión (= día 15 desde fallo): R01 disponible como paid_addon', () => {
    const suspendedAt = new Date(NOW.getTime() - 11 * DAY);
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt,
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    // Día 11 >= 11 → R01 disponible. Equivale a día 15 total desde el fallo de pago.
    expect(decision.decision).toBe('paid_addon');
    expect(decision.reasonCode).toBe('fixed_paid');
  });

  // Test 8: claridad de wording — día 11.5 desde suspensión también permitido
  it('día 11.5 desde suspensión (= día 15.5 desde fallo): R01 sigue disponible', () => {
    const suspendedAt = new Date(NOW.getTime() - 11.5 * DAY);
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt,
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    expect(decision.decision).toBe('paid_addon');
  });

  it('día 10.99 desde suspensión (= día 14.99 desde fallo): R01 sigue bloqueado', () => {
    const suspendedAt = new Date(NOW.getTime() - 10.99 * DAY);
    const decision = resolveCatalogRequest(makeInput({
      capability: r01Capability,
      planRule: r01Rule,
      requestKind: 'reactivation',
      project: {
        ...baseLiveProject,
        status: 'SUSPENDED',
        suspendedAt,
        reactivationFeeActive: false,
      },
      now: NOW,
    }));
    // Todavía por debajo del umbral de 11 días → bloqueado
    expect(decision.decision).toBe('blocked_invalid_project_state');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });
});
