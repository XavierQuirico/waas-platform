import { describe, expect, it } from 'vitest';
import { buildPayPalRequestId } from '@/lib/paypal/client';

describe('buildPayPalRequestId (paypal/client)', () => {
  it('builds a deterministic idempotency key', () => {
    const id1 = buildPayPalRequestId('order', 'ticket-uuid-abc', 2);
    const id2 = buildPayPalRequestId('order', 'ticket-uuid-abc', 2);
    expect(id1).toBe(id2);
  });

  it('changes when revision changes', () => {
    const id1 = buildPayPalRequestId('order', 'ticket-uuid-abc', 1);
    const id2 = buildPayPalRequestId('order', 'ticket-uuid-abc', 2);
    expect(id1).not.toBe(id2);
  });

  it('changes when ticket changes', () => {
    const id1 = buildPayPalRequestId('order', 'ticket-aaa', 1);
    const id2 = buildPayPalRequestId('order', 'ticket-bbb', 1);
    expect(id1).not.toBe(id2);
  });

  it('includes prefix, ticketId, and revision', () => {
    const id = buildPayPalRequestId('order', 'TKT-42', 3);
    expect(id).toContain('order');
    expect(id).toContain('TKT-42');
    expect(id).toContain('r3');
  });

  it('changes prefix', () => {
    const id1 = buildPayPalRequestId('order', 'TKT-1', 1);
    const id2 = buildPayPalRequestId('capture', 'TKT-1', 1);
    expect(id1).not.toBe(id2);
  });
});
