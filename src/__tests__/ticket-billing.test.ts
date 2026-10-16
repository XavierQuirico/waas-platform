import { describe, expect, it } from 'vitest';
import {
  canRequestTicketPaymentLegacy,
  canStartTicketWork,
  deriveClientTicketStatus,
  getNextQuoteStatus,
  shouldRecordIncludedUsage,
} from '@/lib/tickets/billing';

describe('deriveClientTicketStatus', () => {
  it('exposes included tickets as included after approval', () => {
    expect(deriveClientTicketStatus('APPROVED', 'included_allowance', 'none')).toBe('included');
  });

  it('exposes priced quotes as waiting for client decision', () => {
    expect(deriveClientTicketStatus('APPROVED', 'quote_required', 'priced')).toBe('quote_priced');
  });

  it('keeps completed tickets delivered regardless of billing decision', () => {
    expect(deriveClientTicketStatus('COMPLETED', 'paid_addon', 'accepted')).toBe('delivered');
  });
});

describe('getNextQuoteStatus', () => {
  it('moves needs_info back to requested when information is supplied', () => {
    expect(getNextQuoteStatus('needs_info', 'resubmit')).toBe('requested');
  });

  it('blocks accepting expired quotes', () => {
    expect(() => getNextQuoteStatus('expired', 'accept')).toThrow('No se puede aceptar una cotizacion expirada.');
  });
});

describe('canRequestTicketPaymentLegacy', () => {
  it('blocks zero dollar paid tickets', () => {
    expect(() => canRequestTicketPaymentLegacy({
      status: 'APPROVED',
      quoteStatus: 'none',
      priceAmount: 0,
      billingDecision: 'paid_addon',
      paypalOrderId: null,
    })).toThrow('No se puede solicitar PayPal para un ticket de $0.');
  });

  it('blocks quote tickets until the quote is accepted', () => {
    expect(() => canRequestTicketPaymentLegacy({
      status: 'APPROVED',
      quoteStatus: 'priced',
      priceAmount: 5900,
      billingDecision: 'quote_required',
      paypalOrderId: null,
    })).toThrow('aceptada');
  });

  it('blocks duplicate pending PayPal orders', () => {
    expect(() => canRequestTicketPaymentLegacy({
      status: 'PAYMENT_PENDING',
      quoteStatus: 'none',
      priceAmount: 5900,
      billingDecision: 'paid_addon',
      paypalOrderId: 'ORDER-1',
    })).toThrow('Ya existe una orden PayPal pendiente para este ticket.');
  });

  it('allows approved accepted quotes with a positive amount', () => {
    expect(canRequestTicketPaymentLegacy({
      status: 'APPROVED',
      quoteStatus: 'accepted',
      priceAmount: 12000,
      billingDecision: 'quote_required',
      paypalOrderId: null,
    })).toBe(true);
  });
});

describe('canStartTicketWork', () => {
  it('allows paid tickets to start regardless of paid billing decision', () => {
    expect(canStartTicketWork({ status: 'PAID', billingDecision: 'paid_addon' })).toBe(true);
  });

  it('allows approved included tickets to start without payment', () => {
    expect(canStartTicketWork({ status: 'APPROVED', billingDecision: 'included_setup' })).toBe(true);
  });

  it('blocks approved paid tickets until payment is registered', () => {
    expect(() => canStartTicketWork({
      status: 'APPROVED',
      billingDecision: 'paid_addon',
    })).toThrow('El ticket debe estar pagado antes de iniciar trabajo.');
  });

  it('blocks approved accepted quote tickets until payment is registered', () => {
    expect(() => canStartTicketWork({
      status: 'APPROVED',
      billingDecision: 'quote_required',
    })).toThrow('El ticket debe estar pagado antes de iniciar trabajo.');
  });
});

describe('shouldRecordIncludedUsage', () => {
  it('records included usage only for completed included decisions', () => {
    expect(shouldRecordIncludedUsage('COMPLETED', 'included_allowance')).toBe(true);
    expect(shouldRecordIncludedUsage('COMPLETED', 'included_setup')).toBe(true);
    expect(shouldRecordIncludedUsage('COMPLETED', 'included_warranty')).toBe(false);
    expect(shouldRecordIncludedUsage('PAID', 'included_allowance')).toBe(false);
  });
});
