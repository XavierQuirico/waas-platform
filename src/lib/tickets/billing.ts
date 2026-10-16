import type { CatalogDecisionCode } from '@/lib/catalog/types';

export type TicketStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type TicketQuoteStatus =
  | 'none'
  | 'requested'
  | 'needs_info'
  | 'priced'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'rejected';

export type QuoteAction =
  | 'request'
  | 'needs_info'
  | 'price'
  | 'accept'
  | 'decline'
  | 'expire'
  | 'reject'
  | 'resubmit';

export type ClientTicketStatus =
  | 'draft'
  | 'submitted'
  | 'included'
  | 'quote_requested'
  | 'quote_needs_info'
  | 'quote_priced'
  | 'ready_to_pay'
  | 'quote_declined'
  | 'quote_expired'
  | 'payment_pending'
  | 'paid'
  | 'in_progress'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

const INCLUDED_DECISIONS = new Set<CatalogDecisionCode>([
  'included_setup',
  'included_allowance',
  'included_warranty',
]);

/**
 * Determina si una cotización ha expirado usando tiempo del servidor.
 * Siempre llama con `now` inyectado para testabilidad.
 */
export function isQuoteExpired(quoteExpiresAt: Date | null | undefined, now: Date): boolean {
  if (!quoteExpiresAt) return false;
  return now >= quoteExpiresAt;
}

/**
 * Deriva el estado visible al cliente desde el estado interno del ticket.
 * No expone enums técnicos, IDs ni notas internas.
 *
 * IMPORTANTE: para distinguir `ready_to_pay` de `quote_priced` debe pasarse `quoteExpiresAt` y `now`.
 * Si se omiten, las cotizaciones aceptadas no expiradas se mostrarán como `ready_to_pay`.
 */
export function deriveClientTicketStatus(
  ticketStatus: TicketStatus,
  billingDecision: CatalogDecisionCode | null,
  quoteStatus: TicketQuoteStatus,
  opts: { quoteExpiresAt?: Date | null; now?: Date } = {},
): ClientTicketStatus {
  if (ticketStatus === 'COMPLETED') return 'delivered';
  if (ticketStatus === 'CANCELLED') return 'cancelled';
  if (ticketStatus === 'REJECTED') return 'rejected';
  if (ticketStatus === 'IN_PROGRESS') return 'in_progress';
  if (ticketStatus === 'PAID') return 'paid';
  if (ticketStatus === 'PAYMENT_PENDING') return 'payment_pending';

  const now = opts.now ?? new Date();

  // Cotización aceptada → ready_to_pay SIEMPRE (una cotización aceptada nunca vence)
  if (quoteStatus === 'accepted') {
    return 'ready_to_pay';
  }

  // Cotización con precio → puede haber expirado
  if (quoteStatus === 'priced') {
    if (isQuoteExpired(opts.quoteExpiresAt, now)) return 'quote_expired';
    return 'quote_priced';
  }

  if (quoteStatus === 'requested') return 'quote_requested';
  if (quoteStatus === 'needs_info') return 'quote_needs_info';

  // declined/expired/rejected → estado informativo unificado para el cliente
  if (quoteStatus === 'declined') return 'quote_declined';
  if (quoteStatus === 'expired') return 'quote_expired';
  if (quoteStatus === 'rejected') return 'rejected';

  if (billingDecision && INCLUDED_DECISIONS.has(billingDecision)) return 'included';
  if (ticketStatus === 'DRAFT') return 'draft';
  return 'submitted';
}

export function getNextQuoteStatus(
  current: TicketQuoteStatus,
  action: QuoteAction,
): TicketQuoteStatus {
  if (action === 'request') return 'requested';
  if (action === 'needs_info') return 'needs_info';
  if (action === 'price') return 'priced';
  if (action === 'expire') return 'expired';
  if (action === 'reject') return 'rejected';
  if (action === 'resubmit' && current === 'needs_info') return 'requested';

  if (action === 'accept') {
    if (current === 'expired') throw new Error('No se puede aceptar una cotizacion expirada.');
    if (current !== 'priced') throw new Error('Solo una cotizacion con precio puede aceptarse.');
    return 'accepted';
  }

  if (action === 'decline') {
    if (current !== 'priced') throw new Error('Solo una cotizacion con precio puede declinarse.');
    return 'declined';
  }

  throw new Error(`Transicion de cotizacion invalida: ${current} -> ${action}`);
}

export interface PaymentRequestTicket {
  status: TicketStatus;
  quoteStatus: TicketQuoteStatus;
  quoteRevision: number;
  quotedPriceCents: number | null;
  priceAmount: number;
  billingDecision: CatalogDecisionCode | null;
  paypalOrderId: string | null;
  paypalOrderQuoteRevision: number | null;
  quoteExpiresAt: Date | null;
}

export function canRequestTicketPayment(
  ticket: PaymentRequestTicket,
  expectedQuoteRevision: number,
  now: Date = new Date(),
) {
  // Idempotencia: si ya existe un pedido para la misma revisión, devolver ok
  if (
    ticket.status === 'PAYMENT_PENDING'
    && ticket.paypalOrderId
    && ticket.paypalOrderQuoteRevision === expectedQuoteRevision
  ) {
    return { alreadyPending: true, orderId: ticket.paypalOrderId } as const;
  }

  if (ticket.status === 'PAYMENT_PENDING' && ticket.paypalOrderId) {
    throw new Error('Ya existe una orden PayPal pendiente para este ticket.');
  }

  if (ticket.status !== 'APPROVED') {
    throw new Error('El ticket debe estar APPROVED antes de solicitar pago.');
  }

  if (ticket.quoteStatus !== 'accepted') {
    throw new Error('La cotizacion debe estar aceptada antes de crear la orden PayPal.');
  }

  if (ticket.quoteRevision !== expectedQuoteRevision) {
    throw new Error('La revision de cotizacion ha cambiado. Recarga para ver la version vigente.');
  }

  // Solo verificar expiración si la cotización no está aceptada (aceptada nunca expira)
  if (ticket.quoteStatus !== 'accepted' && isQuoteExpired(ticket.quoteExpiresAt, now)) {
    throw new Error('La cotizacion ha vencido. Xavier debe emitir una nueva revision.');
  }

  const amount = ticket.quotedPriceCents ?? ticket.priceAmount;
  if (amount <= 0) {
    throw new Error('No se puede solicitar PayPal para un ticket de $0.');
  }

  if (ticket.billingDecision && INCLUDED_DECISIONS.has(ticket.billingDecision)) {
    throw new Error('Los tickets incluidos no requieren pago.');
  }

  return { alreadyPending: false } as const;
}

/**
 * @deprecated - do not call from new code.
 * Compatibilidad con llamadas antiguas que no pasan revisión.
 * Use canRequestTicketPayment instead.
 */
export function canRequestTicketPaymentLegacy(ticket: {
  status: TicketStatus;
  quoteStatus: TicketQuoteStatus;
  priceAmount: number;
  billingDecision: CatalogDecisionCode | null;
  paypalOrderId: string | null;
}): true {
  if (ticket.status === 'PAYMENT_PENDING' && ticket.paypalOrderId) {
    throw new Error('Ya existe una orden PayPal pendiente para este ticket.');
  }
  if (ticket.status !== 'APPROVED') {
    throw new Error('El ticket debe estar APPROVED antes de solicitar pago.');
  }
  if (ticket.quoteStatus !== 'none' && ticket.quoteStatus !== 'accepted') {
    throw new Error('La cotizacion debe estar aceptada antes de solicitar pago.');
  }
  if (ticket.priceAmount <= 0) {
    throw new Error('No se puede solicitar PayPal para un ticket de $0.');
  }
  if (ticket.billingDecision && INCLUDED_DECISIONS.has(ticket.billingDecision)) {
    throw new Error('Los tickets incluidos no requieren pago.');
  }
  return true;
}

export interface StartWorkTicket {
  status: TicketStatus;
  billingDecision: CatalogDecisionCode | null;
}

export function canStartTicketWork(ticket: StartWorkTicket) {
  if (ticket.status === 'PAID') return true;

  if (ticket.status === 'APPROVED' && isIncludedBillingDecision(ticket.billingDecision)) {
    return true;
  }

  if (ticket.status === 'APPROVED') {
    throw new Error('El ticket debe estar pagado antes de iniciar trabajo.');
  }

  throw new Error('El ticket debe estar PAID o APPROVED incluido antes de iniciar trabajo.');
}

export function shouldRecordIncludedUsage(
  status: TicketStatus,
  billingDecision: CatalogDecisionCode | null,
) {
  return status === 'COMPLETED'
    && (billingDecision === 'included_allowance' || billingDecision === 'included_setup');
}

export function isIncludedBillingDecision(decision: CatalogDecisionCode | null) {
  return Boolean(decision && INCLUDED_DECISIONS.has(decision));
}

/**
 * Safely parses a PayPal decimal amount string to integer cents.
 * Rejects: exponentials, negatives, NaN, more than 2 decimals, unsafe integers.
 * Returns null if invalid.
 */
export function safeParsePayPalAmountCents(value: string): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/[eE]/.test(trimmed)) return null;
  if (trimmed.startsWith('-')) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const float = Number(trimmed);
  if (!isFinite(float) || float < 0) return null;
  const cents = Math.round(float * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/** Convierte centavos a string de dos decimales para PayPal */
export function centsToPayPalAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Etiquetas públicas de ClientTicketStatus — nunca exponer enums técnicos */
export const CLIENT_STATUS_LABELS: Record<ClientTicketStatus, string> = {
  draft: 'Borrador',
  submitted: 'En revisión',
  included: 'Incluido en tu plan',
  quote_requested: 'Preparando presupuesto',
  quote_needs_info: 'Necesitamos información',
  quote_priced: 'Presupuesto disponible',
  ready_to_pay: 'Listo para pagar',
  quote_declined: 'Presupuesto no aceptado',
  quote_expired: 'Presupuesto vencido',
  payment_pending: 'Pago pendiente de confirmación',
  paid: 'Pagado',
  in_progress: 'En progreso',
  delivered: 'Completado',
  rejected: 'Solicitud no aprobada',
  cancelled: 'Cancelado',
};
