import { describe, expect, it } from 'vitest';
import {
  isQuoteExpired,
  deriveClientTicketStatus,
  canRequestTicketPayment,
  centsToPayPalAmount,
  safeParsePayPalAmountCents,
  CLIENT_STATUS_LABELS,
  type ClientTicketStatus,
} from '@/lib/tickets/billing';

// ─── isQuoteExpired ────────────────────────────────────────

describe('isQuoteExpired', () => {
  const past = new Date('2025-01-01T00:00:00Z');
  const future = new Date('2030-01-01T00:00:00Z');
  const now = new Date('2026-06-24T12:00:00Z');

  it('returns false for null expiry', () => {
    expect(isQuoteExpired(null, now)).toBe(false);
  });

  it('returns false for undefined expiry', () => {
    expect(isQuoteExpired(undefined, now)).toBe(false);
  });

  it('returns true when expiry is in the past', () => {
    expect(isQuoteExpired(past, now)).toBe(true);
  });

  it('returns false when expiry is in the future', () => {
    expect(isQuoteExpired(future, now)).toBe(false);
  });

  it('returns true when expiry equals now (boundary)', () => {
    expect(isQuoteExpired(now, now)).toBe(true);
  });
});

// ─── deriveClientTicketStatus — expiry paths ──────────────

describe('deriveClientTicketStatus — expiry', () => {
  const now = new Date('2026-06-24T12:00:00Z');
  const pastExpiry = new Date('2026-06-01T00:00:00Z');
  const futureExpiry = new Date('2026-12-31T00:00:00Z');

  it('returns ready_to_pay for accepted quote not expired', () => {
    expect(
      deriveClientTicketStatus('APPROVED', 'quote_required', 'accepted', {
        quoteExpiresAt: futureExpiry,
        now,
      }),
    ).toBe('ready_to_pay');
  });

  it('returns ready_to_pay for accepted quote past expiry (accepted never expires)', () => {
    expect(
      deriveClientTicketStatus('APPROVED', 'quote_required', 'accepted', {
        quoteExpiresAt: pastExpiry,
        now,
      }),
    ).toBe('ready_to_pay');
  });

  it('returns quote_priced for priced quote not expired', () => {
    expect(
      deriveClientTicketStatus('APPROVED', 'quote_required', 'priced', {
        quoteExpiresAt: futureExpiry,
        now,
      }),
    ).toBe('quote_priced');
  });

  it('returns quote_expired for priced quote past expiry', () => {
    expect(
      deriveClientTicketStatus('APPROVED', 'quote_required', 'priced', {
        quoteExpiresAt: pastExpiry,
        now,
      }),
    ).toBe('quote_expired');
  });

  it('returns payment_pending for PAYMENT_PENDING status', () => {
    expect(
      deriveClientTicketStatus('PAYMENT_PENDING', 'quote_required', 'accepted'),
    ).toBe('payment_pending');
  });

  it('returns paid for PAID status', () => {
    expect(
      deriveClientTicketStatus('PAID', 'paid_addon', 'accepted'),
    ).toBe('paid');
  });

  it('returns quote_declined for declined quoteStatus', () => {
    expect(
      deriveClientTicketStatus('APPROVED', 'quote_required', 'declined'),
    ).toBe('quote_declined');
  });
});

// ─── canRequestTicketPayment ──────────────────────────────

describe('canRequestTicketPayment', () => {
  const now = new Date('2026-06-24T12:00:00Z');
  const futureExpiry = new Date('2026-12-31T00:00:00Z');
  const pastExpiry = new Date('2026-01-01T00:00:00Z');

  const baseTicket = {
    status: 'APPROVED' as const,
    quoteStatus: 'accepted' as const,
    quoteRevision: 2,
    quotedPriceCents: 15000,
    priceAmount: 15000,
    billingDecision: 'quote_required' as const,
    paypalOrderId: null,
    paypalOrderQuoteRevision: null,
    quoteExpiresAt: futureExpiry,
  };

  it('returns alreadyPending=false for valid ticket', () => {
    expect(canRequestTicketPayment(baseTicket, 2, now)).toEqual({ alreadyPending: false });
  });

  it('returns alreadyPending=true for same revision already pending', () => {
    const ticket = {
      ...baseTicket,
      status: 'PAYMENT_PENDING' as const,
      paypalOrderId: 'ORDER-123',
      paypalOrderQuoteRevision: 2,
    };
    expect(canRequestTicketPayment(ticket, 2, now)).toEqual({
      alreadyPending: true,
      orderId: 'ORDER-123',
    });
  });

  it('throws when existing PayPal order is for different revision', () => {
    const ticket = {
      ...baseTicket,
      status: 'PAYMENT_PENDING' as const,
      paypalOrderId: 'ORDER-123',
      paypalOrderQuoteRevision: 1,
    };
    expect(() => canRequestTicketPayment(ticket, 2, now)).toThrow();
  });

  it('throws when ticket is not APPROVED', () => {
    expect(() =>
      canRequestTicketPayment({ ...baseTicket, status: 'DRAFT' }, 2, now),
    ).toThrow('APPROVED');
  });

  it('throws when quote not accepted', () => {
    expect(() =>
      canRequestTicketPayment({ ...baseTicket, quoteStatus: 'priced' }, 2, now),
    ).toThrow('aceptada');
  });

  it('throws on revision mismatch', () => {
    expect(() =>
      canRequestTicketPayment(baseTicket, 3, now),
    ).toThrow('revision');
  });

  it('throws when priced quote expired', () => {
    expect(() =>
      canRequestTicketPayment(
        { ...baseTicket, quoteStatus: 'priced', quoteExpiresAt: pastExpiry },
        2,
        now,
      ),
    ).toThrow('aceptada');
  });

  it('accepted quote with past expiry does not throw (accepted never expires)', () => {
    expect(canRequestTicketPayment(
      { ...baseTicket, quoteExpiresAt: pastExpiry },
      2,
      now,
    )).toEqual({ alreadyPending: false });
  });

  it('throws when amount is zero', () => {
    expect(() =>
      canRequestTicketPayment(
        { ...baseTicket, quotedPriceCents: 0, priceAmount: 0 },
        2,
        now,
      ),
    ).toThrow('$0');
  });

  it('throws for included billing decision', () => {
    expect(() =>
      canRequestTicketPayment(
        { ...baseTicket, billingDecision: 'included_warranty' },
        2,
        now,
      ),
    ).toThrow('incluidos');
  });
});

// ─── centsToPayPalAmount ──────────────────────────────────

describe('centsToPayPalAmount', () => {
  it('converts 10000 to "100.00"', () => {
    expect(centsToPayPalAmount(10000)).toBe('100.00');
  });

  it('converts 2500 to "25.00"', () => {
    expect(centsToPayPalAmount(2500)).toBe('25.00');
  });

  it('converts 99 to "0.99"', () => {
    expect(centsToPayPalAmount(99)).toBe('0.99');
  });

  it('converts 150050 to "1500.50"', () => {
    expect(centsToPayPalAmount(150050)).toBe('1500.50');
  });
});

// ─── CLIENT_STATUS_LABELS completeness ───────────────────

describe('CLIENT_STATUS_LABELS', () => {
  const expectedStatuses: ClientTicketStatus[] = [
    'draft',
    'submitted',
    'included',
    'quote_requested',
    'quote_needs_info',
    'quote_priced',
    'ready_to_pay',
    'quote_declined',
    'quote_expired',
    'payment_pending',
    'paid',
    'in_progress',
    'delivered',
    'rejected',
    'cancelled',
  ];

  it('has a label for every ClientTicketStatus', () => {
    for (const status of expectedStatuses) {
      expect(CLIENT_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('labels do not contain enum technical values', () => {
    for (const label of Object.values(CLIENT_STATUS_LABELS)) {
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

// ─── safeParsePayPalAmountCents ───────────────────────────────

describe('safeParsePayPalAmountCents', () => {
  it('parses 100.00 to 10000', () => {
    expect(safeParsePayPalAmountCents('100.00')).toBe(10000);
  });

  it('parses 25.00 to 2500', () => {
    expect(safeParsePayPalAmountCents('25.00')).toBe(2500);
  });

  it('parses 0.99 to 99', () => {
    expect(safeParsePayPalAmountCents('0.99')).toBe(99);
  });

  it('parses 1500.50 to 150050', () => {
    expect(safeParsePayPalAmountCents('1500.50')).toBe(150050);
  });

  it('parses 100 (no decimals) to 10000', () => {
    expect(safeParsePayPalAmountCents('100')).toBe(10000);
  });

  it('parses 1.1 to 110', () => {
    expect(safeParsePayPalAmountCents('1.1')).toBe(110);
  });

  it('returns null for empty string', () => {
    expect(safeParsePayPalAmountCents('')).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(safeParsePayPalAmountCents('-5.00')).toBeNull();
  });

  it('returns null for exponential notation', () => {
    expect(safeParsePayPalAmountCents('1e2')).toBeNull();
  });

  it('returns null for 3 decimal places (1.999)', () => {
    expect(safeParsePayPalAmountCents('1.999')).toBeNull();
  });

  it('returns null for 3 decimal places (1.234)', () => {
    expect(safeParsePayPalAmountCents('1.234')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(safeParsePayPalAmountCents('abc')).toBeNull();
  });

  it('returns null for NaN string', () => {
    expect(safeParsePayPalAmountCents('NaN')).toBeNull();
  });
});
