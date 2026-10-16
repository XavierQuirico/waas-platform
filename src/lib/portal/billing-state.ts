import {
  getPortalProjectDisplayName,
  type PortalProjectDisplayInput,
} from './project-display';

// Pure helpers for portal billing visual state.
// No DB calls — fully unit-testable without mocking.
//
// TIMELINE OFICIAL:
//   Día 0:    fallo de pago.
//   Días 1-3: periodo de gracia — sitio sigue activo.
//   Día 4:    pasa a SUSPENDED; se guarda suspendedAt.
//   Días 1-10 desde suspensión: R01 bloqueado.
//   Día 11 desde suspensión:    R01 disponible como cargo de reactivación.

export type BillingVisualState =
  | 'active'
  | 'in_activation'
  | 'grace'
  | 'suspended'
  | 'r01_active'
  | 'cancelled'
  | 'closed';

export type BillingStatusVariant = 'green' | 'amber' | 'red' | 'neutral';

export interface BillingStateInput {
  status: string;
  paymentGracePeriodUntil: Date | null;
  suspendedAt: Date | null;
  reactivationFeeActive: boolean;
  now?: Date;
}

const IN_ACTIVATION_STATUSES = new Set([
  'PAYMENT_RECEIVED',
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'PROPOSAL_SENT',
  'REQUIRES_REVIEW',
]);

export function isR01ChargeVisibleFromProject(
  suspendedAt: Date | null,
  reactivationFeeActive: boolean,
  now: Date = new Date(),
): boolean {
  if (reactivationFeeActive) return true;
  if (!suspendedAt) return false;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((now.getTime() - suspendedAt.getTime()) / msPerDay);
  return daysSince >= 11;
}

export function deriveBillingVisualState(input: BillingStateInput): BillingVisualState {
  const now = input.now ?? new Date();
  const { status, paymentGracePeriodUntil, suspendedAt, reactivationFeeActive } = input;

  if (status === 'CANCELLED' || status === 'PROPOSAL_EXPIRED') return 'cancelled';
  if (status === 'CLOSED') return 'closed';

  if (status === 'SUSPENDED') {
    if (isR01ChargeVisibleFromProject(suspendedAt, reactivationFeeActive, now)) {
      return 'r01_active';
    }
    return 'suspended';
  }

  if (paymentGracePeriodUntil !== null && paymentGracePeriodUntil > now) {
    return 'grace';
  }

  if (IN_ACTIVATION_STATUSES.has(status)) return 'in_activation';

  return 'active';
}

export function getBillingStatusCopy(state: BillingVisualState): {
  label: string;
  description: string;
  variant: BillingStatusVariant;
} {
  switch (state) {
    case 'active':
      return {
        label: 'Al día',
        description: 'Tu suscripción está activa y al corriente.',
        variant: 'green',
      };
    case 'in_activation':
      return {
        label: 'En activación',
        description: 'Tu proyecto está en proceso de activación.',
        variant: 'neutral',
      };
    case 'grace':
      return {
        label: 'Problema de pago',
        description:
          'Hubo un problema con tu pago. Tu sitio sigue activo durante el periodo de gracia. Revisa tu método de pago o contacta soporte para regularizar.',
        variant: 'amber',
      };
    case 'suspended':
      return {
        label: 'Sitio suspendido',
        description:
          'Tu sitio está suspendido. Regulariza tu pago para restablecer el acceso. Si ya pagaste, escribe a soporte.',
        variant: 'red',
      };
    case 'r01_active':
      return {
        label: 'Reactivación requerida',
        description:
          'Tu sitio está suspendido. Para restablecer el acceso debes regularizar la mensualidad pendiente. Puede aplicar un fee de reactivación.',
        variant: 'red',
      };
    case 'cancelled':
      return {
        label: 'Proyecto cancelado',
        description: 'Este proyecto fue cancelado. Escribe a soporte si tienes preguntas.',
        variant: 'neutral',
      };
    case 'closed':
      return {
        label: 'Proyecto cerrado',
        description: 'Este proyecto fue entregado y cerrado. Escribe a soporte si tienes preguntas.',
        variant: 'neutral',
      };
  }
}

export function formatMoneyCents(cents: number, currency = 'USD'): string {
  if (!isFinite(cents)) return `$0 ${currency}`;
  if (cents % 100 === 0) return `$${cents / 100} ${currency}`;
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}

export function getPaymentEventAmountCents(metadata: Record<string, unknown>): number | null {
  const isValid = (v: unknown): v is number =>
    typeof v === 'number' && isFinite(v) && v > 0;
  if (isValid(metadata.totalAmountCents)) return metadata.totalAmountCents;
  if (isValid(metadata.amountCents)) return metadata.amountCents;
  if (isValid(metadata.grossAmount)) return Math.round(metadata.grossAmount * 100);
  if (isValid(metadata.netAmount)) return Math.round(metadata.netAmount * 100);
  if (isValid(metadata.amount)) return Math.round(metadata.amount * 100);
  return null;
}

export function canShowPayPalManagement(
  projectType: string,
  paypalSubscriptionId: string | null | undefined,
  billingState: BillingVisualState,
): boolean {
  return (
    projectType === 'SUBSCRIPTION' &&
    typeof paypalSubscriptionId === 'string' &&
    paypalSubscriptionId.trim().length > 0 &&
    billingState !== 'cancelled'
  );
}

export function canShowBillingStatusPayPalCta(
  state: BillingVisualState,
  showPayPal: boolean,
): boolean {
  return showPayPal && (['grace', 'suspended', 'r01_active'] as BillingVisualState[]).includes(state);
}

export function getBillingStatusDisplayCopy(
  state: BillingVisualState,
  options?: { showPayPal?: boolean },
): { label: string; description: string; variant: BillingStatusVariant } {
  const showPayPal = options?.showPayPal ?? false;

  if (state === 'grace') {
    return {
      label: 'Problema de pago',
      description: showPayPal
        ? 'Hubo un problema con tu pago. Tu sitio sigue activo durante el periodo de gracia. Actualiza tu método de pago en PayPal.'
        : 'Hubo un problema con tu pago. Tu sitio sigue activo durante el periodo de gracia. Contacta soporte para regularizar.',
      variant: 'amber',
    };
  }

  return getBillingStatusCopy(state);
}

export function getBillingProjectLabel(input: PortalProjectDisplayInput): string {
  return getPortalProjectDisplayName(input);
}

export function formatBillingDate(date: Date): string {
  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
