import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, createRateLimiter } from '@/lib/security/rate-limit';

describe('createRateLimiter', () => {
  it('permite hasta el máximo y bloquea el siguiente', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
    const t = 10_000;

    expect(limiter.check('ip', t).allowed).toBe(true);
    expect(limiter.check('ip', t + 1).allowed).toBe(true);
    const third = limiter.check('ip', t + 2);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = limiter.check('ip', t + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('libera la cuota cuando la ventana termina', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check('ip', 0).allowed).toBe(true);
    expect(limiter.check('ip', 500).allowed).toBe(false);
    expect(limiter.check('ip', 1001).allowed).toBe(true);
  });

  it('cuenta cada clave por separado', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 1).allowed).toBe(false);
  });

  it('no crece sin límite: purga claves vencidas al llegar a maxKeys', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, maxKeys: 3 });
    for (let i = 0; i < 3; i += 1) limiter.check(`old-${i}`, 0);

    // Con las claves viejas vencidas, una nueva debe poder registrarse sin problema.
    expect(limiter.check('fresh', 5000).allowed).toBe(true);
    expect(limiter.check('old-0', 5001).allowed).toBe(true);
  });
});

describe('clientIpFromHeaders', () => {
  const headers = (values: Record<string, string>) => ({
    get: (name: string) => values[name.toLowerCase()] ?? null,
  });

  it('usa la primera IP de x-forwarded-for', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
  });

  it('cae a x-real-ip y luego a "unknown"', () => {
    expect(clientIpFromHeaders(headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIpFromHeaders(headers({}))).toBe('unknown');
  });

  it('acota la longitud del valor', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'a'.repeat(200) })).length).toBe(45);
  });
});
