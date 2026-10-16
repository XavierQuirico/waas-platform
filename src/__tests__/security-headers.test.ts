import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, buildSecurityHeaders } from '@/lib/security/headers';
import { safeEqual } from '@/lib/security/safe-compare';

function directive(csp: string, name: string): string[] {
  const entry = csp.split('; ').find((part) => part.startsWith(`${name} `));
  return entry ? entry.slice(name.length + 1).split(' ') : [];
}

describe('Content-Security-Policy', () => {
  const csp = buildContentSecurityPolicy({ isDev: false });

  it('prohíbe que otros sitios incrusten la aplicación', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('bloquea objetos y restringe <base>', () => {
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
  });

  it('no permite eval en producción, pero sí en desarrollo', () => {
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
    const dev = buildContentSecurityPolicy({ isDev: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
  });

  it('no abre script-src a cualquier origen', () => {
    const scripts = directive(csp, 'script-src');
    expect(scripts).not.toContain('*');
    expect(scripts).not.toContain('https:');
    expect(scripts).not.toContain('http:');
  });

  it('permite los proveedores que la aplicación necesita', () => {
    expect(directive(csp, 'script-src').join(' ')).toContain('paypal.com');
    expect(directive(csp, 'connect-src').join(' ')).toContain('sentry.io');
    expect(directive(csp, 'connect-src').join(' ')).toContain('r2.cloudflarestorage.com');
    expect(directive(csp, 'frame-src').join(' ')).toContain('paypal.com');
  });

  it('permite las sondas de Clerk Protect, que usan puertos no estándar', () => {
    expect(directive(csp, 'connect-src')).toContain('https://*.protect.clerk.com:*');
  });

  it('añade los orígenes propios indicados (p. ej. el dominio de Clerk)', () => {
    const custom = buildContentSecurityPolicy({
      isDev: false,
      appOrigins: ['https://clerk.example.com'],
    });
    expect(directive(custom, 'script-src')).toContain('https://clerk.example.com');
    expect(directive(custom, 'connect-src')).toContain('https://clerk.example.com');
  });
});

describe('buildSecurityHeaders', () => {
  it('incluye las cabeceras de endurecimiento básicas', () => {
    const names = buildSecurityHeaders({ isDev: false }).map((header) => header.key);
    expect(names).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
      ]),
    );
  });

  it('omite HSTS en desarrollo local', () => {
    const names = buildSecurityHeaders({ isDev: true }).map((header) => header.key);
    expect(names).not.toContain('Strict-Transport-Security');
  });
});

describe('safeEqual', () => {
  it('acepta secretos idénticos y rechaza el resto', () => {
    expect(safeEqual('secreto-123', 'secreto-123')).toBe(true);
    expect(safeEqual('secreto-123', 'secreto-124')).toBe(false);
    expect(safeEqual('corto', 'una-cadena-bastante-mas-larga')).toBe(false);
  });

  it('rechaza valores ausentes o vacíos (nunca autoriza sin secreto configurado)', () => {
    expect(safeEqual(null, 'x')).toBe(false);
    expect(safeEqual('x', undefined)).toBe(false);
    expect(safeEqual('', '')).toBe(false);
  });
});
