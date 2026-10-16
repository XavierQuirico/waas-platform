// Pure helpers for payment grace / suspension lifecycle.
// No DB calls — designed to be imported and unit-tested without mocking.
// Fuente de verdad para las reglas de estado de gracia, suspensión y reactivación.
//
// TIMELINE OFICIAL:
//   Día 0:    fallo de pago.
//   Días 1-3: periodo de gracia — proyecto permanece LIVE.
//   Día 4:    si no pagó, proyecto pasa a SUSPENDED; se guarda suspendedAt.
//   Días 1-10 desde suspensión (= días 4-14 desde fallo): R01 bloqueado.
//   Día 11 desde suspensión (= día 15 desde fallo):       R01 disponible como paid_addon.
//   R01 NUNCA se cobra antes del día 15 total desde el fallo de pago.

import type { ProjectStatus } from '@/lib/projects/state-machine';

export interface GracePeriodProject {
  status: ProjectStatus;
  paymentGracePeriodUntil: Date | null;
}

/**
 * Determines whether the Inngest job should proceed to suspend a project
 * after the 3-day grace period has elapsed.
 *
 * Returns false when:
 * - Project was cancelled or closed before the job woke up.
 * - Project was already suspended by another mechanism.
 * - paymentGracePeriodUntil is null — cleared by a successful payment → payment regularized.
 */
export function shouldSuspendAfterGrace(project: GracePeriodProject): boolean {
  if (
    project.status === 'CANCELLED' ||
    project.status === 'CLOSED' ||
    project.status === 'SUSPENDED'
  ) {
    return false;
  }
  if (project.paymentGracePeriodUntil === null) {
    return false;
  }
  return true;
}

/**
 * DB fields to apply when recording a payment failure grace period.
 * Project stays in its current status (e.g. LIVE) — grace is 3 days from now.
 */
export function buildGracePeriodFields(now: Date): {
  paymentGracePeriodUntil: Date;
  updatedAt: Date;
} {
  return {
    paymentGracePeriodUntil: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    updatedAt: now,
  };
}

/**
 * DB fields to apply when an automatic suspension occurs (Inngest after 3-day grace).
 */
export function buildSuspendFields(now: Date): {
  status: 'SUSPENDED';
  suspendedAt: Date;
  paymentGracePeriodUntil: null;
  updatedAt: Date;
} {
  return {
    status: 'SUSPENDED',
    suspendedAt: now,
    paymentGracePeriodUntil: null,
    updatedAt: now,
  };
}

/**
 * DB fields to apply when el admin manually suspends a project.
 * reactivationFeeActive defaults to false — must be explicitly enabled by admin.
 */
export function buildManualSuspendFields(now: Date): {
  status: 'SUSPENDED';
  suspendedAt: Date;
  paymentGracePeriodUntil: null;
  reactivationFeeActive: false;
  updatedAt: Date;
} {
  return {
    status: 'SUSPENDED',
    suspendedAt: now,
    paymentGracePeriodUntil: null,
    reactivationFeeActive: false,
    updatedAt: now,
  };
}

/**
 * DB fields to apply when a project is reactivated (manual or via payment).
 * Clears ALL suspension-related state so no residual flags remain.
 */
export function buildReactivationFields(now: Date): {
  status: 'LIVE';
  suspendedAt: null;
  paymentGracePeriodUntil: null;
  reactivationFeeActive: false;
  updatedAt: Date;
} {
  return {
    status: 'LIVE',
    suspendedAt: null,
    paymentGracePeriodUntil: null,
    reactivationFeeActive: false,
    updatedAt: now,
  };
}

/**
 * DB fields to apply when a successful subscription payment clears the grace period.
 * Does NOT change status — the project stays LIVE (or whatever it currently is).
 */
export function buildPaymentSuccessGraceClearFields(now: Date): {
  paymentGracePeriodUntil: null;
  updatedAt: Date;
} {
  return {
    paymentGracePeriodUntil: null,
    updatedAt: now,
  };
}

/**
 * Returns true if the PayPal event type signals a successful recurring subscription payment.
 *
 * Supported:
 *   - BILLING.SUBSCRIPTION.PAYMENT.COMPLETED  — Subscriptions v2 API (current)
 *   - PAYMENT.SALE.COMPLETED with billing_agreement_id  — Billing Agreements / legacy API
 *
 * These are the only two events that should trigger grace-period cleanup.
 * Setup fees (PAYMENT.CAPTURE.COMPLETED) and ticket payments are NOT included.
 */
export function isRecurringPaymentSuccessEvent(eventType: string): boolean {
  return (
    eventType === 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED' ||
    eventType === 'PAYMENT.SALE.COMPLETED'
  );
}

/**
 * Extracts the PayPal subscription ID from a recurring payment success event payload.
 *
 * - BILLING.SUBSCRIPTION.PAYMENT.COMPLETED: subscription ID is resource.id
 * - PAYMENT.SALE.COMPLETED: subscription ID is resource.billing_agreement_id
 *   (present only when the sale is linked to a Billing Agreement / legacy subscription)
 *
 * Returns null if the event type is unrecognized or if the relevant field is absent.
 * The caller must not update any DB record when null is returned.
 */
export function extractPayPalSubscriptionId(
  eventType: string,
  resource: Record<string, unknown>
): string | null {
  if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED') {
    const id = resource.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    const id = resource.billing_agreement_id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  return null;
}
