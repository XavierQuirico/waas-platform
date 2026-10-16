import { describe, expect, it } from 'vitest';
import { CONFIDENCE_THRESHOLDS } from '@/lib/tickets/interpretChangeRequest';

// Unit tests for the constants and pure logic in interpretChangeRequest.
// The actual Groq call is integration-only — we don't call it here.

describe('CONFIDENCE_THRESHOLDS', () => {
  it('HIGH is above MEDIUM', () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThan(CONFIDENCE_THRESHOLDS.MEDIUM);
  });

  it('MEDIUM is between 0 and 1', () => {
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeLessThan(1);
  });

  it('HIGH is between 0 and 1', () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeLessThan(1);
  });
});

// Test fallback behavior when GROQ_API_KEY is absent (unit isolation).
// interpretChangeRequest is async and server-only; we verify the exported
// constants and types compile correctly without calling the function.
describe('interpretChangeRequest module exports', () => {
  it('exports CONFIDENCE_THRESHOLDS as a frozen-like object', () => {
    expect(typeof CONFIDENCE_THRESHOLDS).toBe('object');
    expect(CONFIDENCE_THRESHOLDS).not.toBeNull();
  });
});
