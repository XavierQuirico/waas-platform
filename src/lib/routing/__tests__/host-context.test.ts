import { describe, it, expect } from 'vitest';
import {
  getHostContext,
  inferContextFromRedirect,
  sanitizeRedirect,
  sanitizeContextualRedirect,
  getDefaultRedirectForContext,
  isPortalPath,
  isAdminPath,
  isPublicPath,
  adminHref,
} from '../host-context';

// ─── getHostContext ──────────────────────────────────────────────────────────

describe('getHostContext', () => {
  it('portal.quiricostudios.com → portal', () => {
    expect(getHostContext('portal.quiricostudios.com')).toBe('portal');
  });

  it('admin.quiricostudios.com → admin', () => {
    expect(getHostContext('admin.quiricostudios.com')).toBe('admin');
  });

  it('quiricostudios.com → public', () => {
    expect(getHostContext('quiricostudios.com')).toBe('public');
  });

  it('www.quiricostudios.com → public', () => {
    expect(getHostContext('www.quiricostudios.com')).toBe('public');
  });

  it('localhost → dev', () => {
    expect(getHostContext('localhost')).toBe('dev');
  });

  it('localhost:3000 → dev (strips port)', () => {
    expect(getHostContext('localhost:3000')).toBe('dev');
  });

  it('127.0.0.1 → dev', () => {
    expect(getHostContext('127.0.0.1')).toBe('dev');
  });

  it('127.0.0.1:3000 → dev (strips port)', () => {
    expect(getHostContext('127.0.0.1:3000')).toBe('dev');
  });

  it('PORTAL.QUIRICOSTUDIOS.COM → portal (case insensitive)', () => {
    expect(getHostContext('PORTAL.QUIRICOSTUDIOS.COM')).toBe('portal');
  });

  it('ADMIN.QUIRICOSTUDIOS.COM → admin (case insensitive)', () => {
    expect(getHostContext('ADMIN.QUIRICOSTUDIOS.COM')).toBe('admin');
  });
});

// ─── getDefaultRedirectForContext ────────────────────────────────────────────

describe('getDefaultRedirectForContext', () => {
  it('portal → /dashboard', () => {
    expect(getDefaultRedirectForContext('portal')).toBe('/dashboard');
  });

  it('admin → /dashboard', () => {
    expect(getDefaultRedirectForContext('admin')).toBe('/dashboard');
  });

  it('dev → /dashboard', () => {
    expect(getDefaultRedirectForContext('dev')).toBe('/dashboard');
  });

  it('public → /', () => {
    expect(getDefaultRedirectForContext('public')).toBe('/');
  });
});

// ─── sanitizeRedirect ────────────────────────────────────────────────────────

describe('sanitizeRedirect', () => {
  it('accepts valid relative path', () => {
    expect(sanitizeRedirect('/dashboard', '/fallback')).toBe('/dashboard');
  });

  it('rejects absolute URL (https://)', () => {
    expect(sanitizeRedirect('https://evil.com', '/fallback')).toBe('/fallback');
  });

  it('rejects protocol-relative URL (//evil.com)', () => {
    expect(sanitizeRedirect('//evil.com', '/fallback')).toBe('/fallback');
  });

  it('rejects backslash path', () => {
    expect(sanitizeRedirect('\\evil', '/fallback')).toBe('/fallback');
  });

  it('rejects path not starting with /', () => {
    expect(sanitizeRedirect('evil/path', '/fallback')).toBe('/fallback');
  });

  it('returns fallback for undefined', () => {
    expect(sanitizeRedirect(undefined, '/fallback')).toBe('/fallback');
  });

  it('returns fallback for empty string', () => {
    expect(sanitizeRedirect('', '/fallback')).toBe('/fallback');
  });
});

// ─── sanitizeContextualRedirect ──────────────────────────────────────────────

describe('sanitizeContextualRedirect — portal context', () => {
  it('/dashboard → allowed', () => {
    expect(sanitizeContextualRedirect('/dashboard', 'portal')).toBe('/dashboard');
  });

  it('/proyecto/abc → allowed', () => {
    expect(sanitizeContextualRedirect('/proyecto/abc', 'portal')).toBe('/proyecto/abc');
  });

  it('/admin → rejected, returns /dashboard fallback', () => {
    expect(sanitizeContextualRedirect('/admin', 'portal')).toBe('/dashboard');
  });

  it('/proyectos → rejected (admin-only path)', () => {
    expect(sanitizeContextualRedirect('/proyectos', 'portal')).toBe('/dashboard');
  });

  it('//evil.com → rejected', () => {
    expect(sanitizeContextualRedirect('//evil.com', 'portal')).toBe('/dashboard');
  });

  it('https://evil.com → rejected', () => {
    expect(sanitizeContextualRedirect('https://evil.com', 'portal')).toBe('/dashboard');
  });
});

describe('sanitizeContextualRedirect — admin context', () => {
  it('/dashboard → allowed', () => {
    expect(sanitizeContextualRedirect('/dashboard', 'admin')).toBe('/dashboard');
  });

  it('/proyectos → allowed', () => {
    expect(sanitizeContextualRedirect('/proyectos', 'admin')).toBe('/proyectos');
  });

  it('/proyectos/abc123 → allowed', () => {
    expect(sanitizeContextualRedirect('/proyectos/abc123', 'admin')).toBe('/proyectos/abc123');
  });

  it('/admin/proyectos → allowed (dev/compat)', () => {
    expect(sanitizeContextualRedirect('/admin/proyectos', 'admin')).toBe('/admin/proyectos');
  });

  it('/portal → rejected (portal-only)', () => {
    expect(sanitizeContextualRedirect('/portal', 'admin')).toBe('/dashboard');
  });

  it('//evil.com → rejected', () => {
    expect(sanitizeContextualRedirect('//evil.com', 'admin')).toBe('/dashboard');
  });
});

describe('sanitizeContextualRedirect — public context', () => {
  it('/ → allowed', () => {
    expect(sanitizeContextualRedirect('/', 'public')).toBe('/');
  });

  it('/empezar → allowed', () => {
    expect(sanitizeContextualRedirect('/empezar', 'public')).toBe('/empezar');
  });

  it('/dashboard → rejected (needs subdomain)', () => {
    expect(sanitizeContextualRedirect('/dashboard', 'public')).toBe('/');
  });

  it('/admin → rejected', () => {
    expect(sanitizeContextualRedirect('/admin', 'public')).toBe('/');
  });
});

// ─── inferContextFromRedirect ─────────────────────────────────────────────────

describe('inferContextFromRedirect', () => {
  it('/dashboard → portal', () => {
    expect(inferContextFromRedirect('/dashboard')).toBe('portal');
  });

  it('/admin/proyectos → admin', () => {
    expect(inferContextFromRedirect('/admin/proyectos')).toBe('admin');
  });

  it('/admin → admin', () => {
    expect(inferContextFromRedirect('/admin')).toBe('admin');
  });

  it('/proyectos → admin (clean path)', () => {
    expect(inferContextFromRedirect('/proyectos')).toBe('admin');
  });

  it('/clientes → admin', () => {
    expect(inferContextFromRedirect('/clientes')).toBe('admin');
  });

  it('/dev → admin', () => {
    expect(inferContextFromRedirect('/dev')).toBe('admin');
  });

  it('/proyecto/abc → portal', () => {
    expect(inferContextFromRedirect('/proyecto/abc')).toBe('portal');
  });

  it('/onboarding → portal', () => {
    expect(inferContextFromRedirect('/onboarding')).toBe('portal');
  });

  it('/ → public', () => {
    expect(inferContextFromRedirect('/')).toBe('public');
  });

  it('/empezar → public', () => {
    expect(inferContextFromRedirect('/empezar')).toBe('public');
  });
});

// ─── isPortalPath ────────────────────────────────────────────────────────────

describe('isPortalPath', () => {
  it('/dashboard → true', () => {
    expect(isPortalPath('/dashboard')).toBe(true);
  });

  it('/proyecto/abc → true', () => {
    expect(isPortalPath('/proyecto/abc')).toBe(true);
  });

  it('/admin → false', () => {
    expect(isPortalPath('/admin')).toBe(false);
  });

  it('/proyectos → false (admin clean path)', () => {
    expect(isPortalPath('/proyectos')).toBe(false);
  });
});

// ─── isAdminPath ─────────────────────────────────────────────────────────────

describe('isAdminPath', () => {
  it('/admin → true', () => {
    expect(isAdminPath('/admin')).toBe(true);
  });

  it('/admin/proyectos → true', () => {
    expect(isAdminPath('/admin/proyectos')).toBe(true);
  });

  it('/proyectos → true (clean admin path)', () => {
    expect(isAdminPath('/proyectos')).toBe(true);
  });

  it('/dashboard → true (shared home)', () => {
    expect(isAdminPath('/dashboard')).toBe(true);
  });

  it('/portal → false', () => {
    expect(isAdminPath('/portal')).toBe(false);
  });
});

// ─── isPublicPath ─────────────────────────────────────────────────────────────

describe('isPublicPath', () => {
  it('/ → true', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('/empezar → true', () => {
    expect(isPublicPath('/empezar')).toBe(true);
  });

  it('/acceder → true', () => {
    expect(isPublicPath('/acceder')).toBe(true);
  });

  it('/sign-in → true', () => {
    expect(isPublicPath('/sign-in')).toBe(true);
  });

  it('/api/health → true', () => {
    expect(isPublicPath('/api/health')).toBe(true);
  });

  it('/api/trpc/intake/submitV2 → true', () => {
    expect(isPublicPath('/api/trpc/intake/submitV2')).toBe(true);
  });

  it('/dashboard → false (private)', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
  });

  it('/admin → false (private)', () => {
    expect(isPublicPath('/admin')).toBe(false);
  });
});

// ─── isPortalPath — /configuracion (4G) ─────────────────────────────────────

describe('isPortalPath — /configuracion (4G)', () => {
  it('/configuracion → true', () => {
    expect(isPortalPath('/configuracion')).toBe(true);
  });

  it('/configuracion/perfil → true (subruta)', () => {
    expect(isPortalPath('/configuracion/perfil')).toBe(true);
  });
});

// ─── sanitizeContextualRedirect — rutas 4G ───────────────────────────────────

describe('sanitizeContextualRedirect — 4G: configuracion + rutas prohibidas portal', () => {
  it('/configuracion portal → /configuracion', () => {
    expect(sanitizeContextualRedirect('/configuracion', 'portal')).toBe('/configuracion');
  });

  it('/configuracion/perfil portal → /configuracion/perfil', () => {
    expect(sanitizeContextualRedirect('/configuracion/perfil', 'portal')).toBe('/configuracion/perfil');
  });

  it('/billing portal → /dashboard (alias legacy, no es safe path)', () => {
    expect(sanitizeContextualRedirect('/billing', 'portal')).toBe('/dashboard');
  });

  it('/portal/billing portal → /dashboard (alias legacy, no es safe path)', () => {
    expect(sanitizeContextualRedirect('/portal/billing', 'portal')).toBe('/dashboard');
  });

  it('/sign-in portal → /dashboard (ruta técnica, no visible)', () => {
    expect(sanitizeContextualRedirect('/sign-in', 'portal')).toBe('/dashboard');
  });

  it('/sign-up portal → /dashboard (ruta técnica, no visible)', () => {
    expect(sanitizeContextualRedirect('/sign-up', 'portal')).toBe('/dashboard');
  });
});

// ─── adminHref ───────────────────────────────────────────────────────────────

describe('adminHref', () => {
  it('/admin → /dashboard on admin subdomain', () => {
    expect(adminHref('/admin', 'admin')).toBe('/dashboard');
  });

  it('/admin/proyectos → /proyectos on admin subdomain', () => {
    expect(adminHref('/admin/proyectos', 'admin')).toBe('/proyectos');
  });

  it('/admin/proyectos/abc → /proyectos/abc on admin subdomain', () => {
    expect(adminHref('/admin/proyectos/abc', 'admin')).toBe('/proyectos/abc');
  });

  it('/admin/clientes → /clientes on admin subdomain', () => {
    expect(adminHref('/admin/clientes', 'admin')).toBe('/clientes');
  });

  it('/admin/proyectos → unchanged on dev', () => {
    expect(adminHref('/admin/proyectos', 'dev')).toBe('/admin/proyectos');
  });

  it('/admin → unchanged on public', () => {
    expect(adminHref('/admin', 'public')).toBe('/admin');
  });

  it('/admin/incidencias → /incidencias on admin subdomain', () => {
    expect(adminHref('/admin/incidencias', 'admin')).toBe('/incidencias');
  });
});
