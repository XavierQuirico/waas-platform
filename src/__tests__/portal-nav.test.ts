import { describe, it, expect } from 'vitest';
import { deriveProjectType, deriveBillingPlan } from '@/lib/portal/project-type';
import { getPortalNavItems, getLimitedPortalNavItems, isPortalNavItemActive } from '@/lib/portal/nav';

// ─── deriveProjectType ────────────────────────────────────────

describe('deriveProjectType', () => {
  it('portfolioFlag=true → PORTFOLIO (independiente del plan)', () => {
    expect(deriveProjectType('BASIC', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('PRO', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('BUSINESS', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('LEGACY', true)).toBe('PORTFOLIO');
  });

  it('plan=LEGACY sin portfolioFlag → LEGACY', () => {
    expect(deriveProjectType('LEGACY', false)).toBe('LEGACY');
  });

  it('plan=BASIC sin portfolioFlag → SUBSCRIPTION', () => {
    expect(deriveProjectType('BASIC', false)).toBe('SUBSCRIPTION');
  });

  it('plan=PRO sin portfolioFlag → SUBSCRIPTION', () => {
    expect(deriveProjectType('PRO', false)).toBe('SUBSCRIPTION');
  });

  it('plan=BUSINESS sin portfolioFlag → SUBSCRIPTION', () => {
    expect(deriveProjectType('BUSINESS', false)).toBe('SUBSCRIPTION');
  });
});

// ─── deriveBillingPlan ────────────────────────────────────────

describe('deriveBillingPlan', () => {
  it('SUBSCRIPTION + BASIC → BASIC', () => {
    expect(deriveBillingPlan('BASIC', 'SUBSCRIPTION')).toBe('BASIC');
  });

  it('SUBSCRIPTION + PRO → PRO', () => {
    expect(deriveBillingPlan('PRO', 'SUBSCRIPTION')).toBe('PRO');
  });

  it('SUBSCRIPTION + BUSINESS → BUSINESS', () => {
    expect(deriveBillingPlan('BUSINESS', 'SUBSCRIPTION')).toBe('BUSINESS');
  });

  it('PORTFOLIO → null (sin plan de facturación)', () => {
    expect(deriveBillingPlan('BASIC', 'PORTFOLIO')).toBeNull();
  });

  it('LEGACY → null (sin plan de facturación)', () => {
    expect(deriveBillingPlan('LEGACY', 'LEGACY')).toBeNull();
  });
});

// ─── getPortalNavItems — SUBSCRIPTION ─────────────────────────

describe('getPortalNavItems — SUBSCRIPTION', () => {
  const nav = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: 'proj-123' });

  it('incluye Facturación con href /facturacion', () => {
    const item = nav.find((n) => n.id === 'facturacion');
    expect(item).toBeDefined();
    expect(item?.href).toBe('/facturacion');
  });

  it('incluye Cambios y mejoras', () => {
    expect(nav.some((n) => n.id === 'cambios')).toBe(true);
  });

  it('incluye Incidencias', () => {
    expect(nav.some((n) => n.id === 'incidencias')).toBe(true);
  });

  it('NO incluye Mantenimiento', () => {
    expect(nav.some((n) => n.id === 'mantenimiento')).toBe(false);
  });

  it('incluye Soporte', () => {
    expect(nav.some((n) => n.id === 'soporte')).toBe(true);
  });

  it('Proyecto apunta a /proyecto/proj-123', () => {
    const item = nav.find((n) => n.id === 'proyecto');
    expect(item?.href).toBe('/proyecto/proj-123');
  });

  it('ningún href contiene /portal/', () => {
    for (const item of nav) {
      expect(item.href).not.toMatch(/^\/portal\//);
    }
  });
});

// ─── getPortalNavItems — LEGACY ───────────────────────────────

describe('getPortalNavItems — LEGACY', () => {
  const nav = getPortalNavItems({ projectType: 'LEGACY', projectId: 'proj-abc' });

  it('incluye Mantenimiento con href /mantenimiento', () => {
    const item = nav.find((n) => n.id === 'mantenimiento');
    expect(item).toBeDefined();
    expect(item?.href).toBe('/mantenimiento');
  });

  it('incluye Facturación', () => {
    expect(nav.some((n) => n.id === 'facturacion')).toBe(true);
  });

  it('incluye Cambios y mejoras', () => {
    expect(nav.some((n) => n.id === 'cambios')).toBe(true);
  });

  it('incluye Incidencias', () => {
    expect(nav.some((n) => n.id === 'incidencias')).toBe(true);
  });

  it('ningún href contiene /portal/', () => {
    for (const item of nav) {
      expect(item.href).not.toMatch(/^\/portal\//);
    }
  });
});

// ─── getPortalNavItems — PORTFOLIO ────────────────────────────

describe('getPortalNavItems — PORTFOLIO', () => {
  const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'proj-xyz' });

  it('NO incluye Facturación', () => {
    expect(nav.some((n) => n.id === 'facturacion')).toBe(false);
  });

  it('NO incluye Cambios y mejoras', () => {
    expect(nav.some((n) => n.id === 'cambios')).toBe(false);
  });

  it('NO incluye Incidencias', () => {
    expect(nav.some((n) => n.id === 'incidencias')).toBe(false);
  });

  it('NO incluye Mantenimiento', () => {
    expect(nav.some((n) => n.id === 'mantenimiento')).toBe(false);
  });

  it('incluye Soporte', () => {
    expect(nav.some((n) => n.id === 'soporte')).toBe(true);
  });

  it('incluye Inicio, Proyecto y Mi sitio', () => {
    expect(nav.some((n) => n.id === 'inicio')).toBe(true);
    expect(nav.some((n) => n.id === 'proyecto')).toBe(true);
    expect(nav.some((n) => n.id === 'misitio')).toBe(true);
  });

  it('ningún href contiene /portal/', () => {
    for (const item of nav) {
      expect(item.href).not.toMatch(/^\/portal\//);
    }
  });
});

// ─── getPortalNavItems — sin projectId ────────────────────────

describe('getPortalNavItems — sin projectId', () => {
  it('Proyecto apunta a /dashboard cuando projectId es null', () => {
    const nav = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: null });
    const item = nav.find((n) => n.id === 'proyecto');
    expect(item?.href).toBe('/dashboard');
  });
});

// ─── Facturación billing behavior (invariantes) ───────────────

describe('facturación billing behavior — invariantes', () => {
  it('PORTFOLIO nunca tiene Facturación en nav', () => {
    const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: null });
    expect(nav.some((n) => n.href === '/facturacion')).toBe(false);
  });

  it('SUBSCRIPTION siempre tiene Facturación en nav', () => {
    const nav = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: null });
    expect(nav.some((n) => n.href === '/facturacion')).toBe(true);
  });

  it('LEGACY tiene Facturación en nav', () => {
    const nav = getPortalNavItems({ projectType: 'LEGACY', projectId: null });
    expect(nav.some((n) => n.href === '/facturacion')).toBe(true);
  });

  it('portfolioFlag=true ⟹ projectType PORTFOLIO ⟹ no Facturación en nav', () => {
    const projectType = deriveProjectType('BASIC', true);
    const nav = getPortalNavItems({ projectType, projectId: null });
    expect(projectType).toBe('PORTFOLIO');
    expect(nav.some((n) => n.href === '/facturacion')).toBe(false);
  });

  it('deriveBillingPlan para PORTFOLIO devuelve null (sin plan activo)', () => {
    const projectType = deriveProjectType('PRO', true);
    expect(deriveBillingPlan('PRO', projectType)).toBeNull();
  });

  it('LEGACY billingPlan es null (sin suscripción activa)', () => {
    expect(deriveBillingPlan('LEGACY', 'LEGACY')).toBeNull();
  });
});

// ─── getLimitedPortalNavItems — sin proyecto ──────────────────

describe('getLimitedPortalNavItems', () => {
  const nav = getLimitedPortalNavItems();

  it('incluye Soporte', () => {
    expect(nav.some((item) => item.id === 'soporte')).toBe(true);
  });

  it('NO incluye Facturación', () => {
    expect(nav.some((item) => item.id === 'facturacion')).toBe(false);
  });

  it('NO incluye Cambios', () => {
    expect(nav.some((item) => item.id === 'cambios')).toBe(false);
  });

  it('NO incluye Incidencias', () => {
    expect(nav.some((item) => item.id === 'incidencias')).toBe(false);
  });

  it('NO incluye Mi sitio', () => {
    expect(nav.some((item) => item.id === 'misitio')).toBe(false);
  });

  it('NO incluye Proyecto', () => {
    expect(nav.some((item) => item.id === 'proyecto')).toBe(false);
  });

  it('ningún href comienza con /portal/', () => {
    expect(nav.every((item) => !item.href.startsWith('/portal/'))).toBe(true);
  });
});

// ─── Configuración presente en todos los tipos ───────────────

describe('getPortalNavItems — Configuración presente en todos los tipos', () => {
  it('SUBSCRIPTION incluye Configuración con href /configuracion', () => {
    const nav = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: 'p1' });
    const item = nav.find((n) => n.id === 'configuracion');
    expect(item).toBeDefined();
    expect(item?.href).toBe('/configuracion');
  });

  it('LEGACY incluye Configuración con href /configuracion', () => {
    const nav = getPortalNavItems({ projectType: 'LEGACY', projectId: 'p1' });
    const item = nav.find((n) => n.id === 'configuracion');
    expect(item).toBeDefined();
    expect(item?.href).toBe('/configuracion');
  });

  it('PORTFOLIO incluye Configuración con href /configuracion', () => {
    const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'p1' });
    const item = nav.find((n) => n.id === 'configuracion');
    expect(item).toBeDefined();
    expect(item?.href).toBe('/configuracion');
  });
});

// ─── Hrefs prohibidos — ningún tipo puede producirlos ────────

describe('getPortalNavItems — hrefs prohibidos', () => {
  const allTypes = ['SUBSCRIPTION', 'LEGACY', 'PORTFOLIO'] as const;
  const PROHIBITED = ['/billing', '/portal/billing', '/sign-in', '/sign-up'];

  for (const type of allTypes) {
    it(`${type}: ningún href es /billing ni /portal/billing ni /sign-in ni /sign-up`, () => {
      const nav = getPortalNavItems({ projectType: type, projectId: 'p1' });
      for (const item of nav) {
        for (const prohibited of PROHIBITED) {
          expect(item.href).not.toBe(prohibited);
        }
        expect(item.href).not.toMatch(/^\/portal\//);
      }
    });

    it(`${type}: ningún href es URL absoluta externa`, () => {
      const nav = getPortalNavItems({ projectType: type, projectId: null });
      for (const item of nav) {
        expect(item.href).toMatch(/^\//);
        expect(item.href).not.toMatch(/^https?:\/\//);
      }
    });
  }
});

// ─── isPortalNavItemActive ────────────────────────────────────

describe('isPortalNavItemActive', () => {
  const inicio = { id: 'inicio', icon: 'dashboard', label: 'Inicio', href: '/dashboard' };
  const proyecto = { id: 'proyecto', icon: 'folder', label: 'Proyecto', href: '/proyecto/p1' };
  const incidencias = { id: 'incidencias', icon: 'alert', label: 'Incidencias', href: '/incidencias' };
  const facturacion = { id: 'facturacion', icon: 'creditcard', label: 'Facturación', href: '/facturacion' };
  const configuracion = { id: 'configuracion', icon: 'settings', label: 'Configuración', href: '/configuracion' };

  it('Inicio activo solo en /dashboard', () => {
    expect(isPortalNavItemActive(inicio, '/dashboard')).toBe(true);
  });

  it('Inicio NO activo en /dashboard/algo', () => {
    expect(isPortalNavItemActive(inicio, '/dashboard/algo')).toBe(false);
  });

  it('Proyecto activo en /proyecto/p1', () => {
    expect(isPortalNavItemActive(proyecto, '/proyecto/p1')).toBe(true);
  });

  it('Proyecto activo en /proyecto/p1/staging', () => {
    expect(isPortalNavItemActive(proyecto, '/proyecto/p1/staging')).toBe(true);
  });

  it('Proyecto activo en /proyecto/p1/assets', () => {
    expect(isPortalNavItemActive(proyecto, '/proyecto/p1/assets')).toBe(true);
  });

  it('Proyecto activo en /proyecto/p1/solicitudes', () => {
    expect(isPortalNavItemActive(proyecto, '/proyecto/p1/solicitudes')).toBe(true);
  });

  it('Proyecto activo en /proyecto/otro-id', () => {
    expect(isPortalNavItemActive(proyecto, '/proyecto/otro-id')).toBe(true);
  });

  it('Incidencias activo en /incidencias', () => {
    expect(isPortalNavItemActive(incidencias, '/incidencias')).toBe(true);
  });

  it('Incidencias activo en /proyecto/p1/incidencias', () => {
    expect(isPortalNavItemActive(incidencias, '/proyecto/p1/incidencias')).toBe(true);
  });

  it('Incidencias activo en /proyecto/p1/incidencias/abc', () => {
    expect(isPortalNavItemActive(incidencias, '/proyecto/p1/incidencias/abc')).toBe(true);
  });

  it('Facturación activo en /facturacion', () => {
    expect(isPortalNavItemActive(facturacion, '/facturacion')).toBe(true);
  });

  it('Facturación NO activo en /facturacion-algo (evita falso positivo)', () => {
    expect(isPortalNavItemActive(facturacion, '/facturacion-algo')).toBe(false);
  });

  it('Configuración activo en /configuracion', () => {
    expect(isPortalNavItemActive(configuracion, '/configuracion')).toBe(true);
  });

  it('Configuración activo en /configuracion/perfil', () => {
    expect(isPortalNavItemActive(configuracion, '/configuracion/perfil')).toBe(true);
  });

  it('Configuración NO activo en /configuracion-extra', () => {
    expect(isPortalNavItemActive(configuracion, '/configuracion-extra')).toBe(false);
  });
});
