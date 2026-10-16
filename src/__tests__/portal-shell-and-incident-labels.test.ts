/**
 * portal-5v2-fix-triage.test.ts
 * Portal cliente — comportamientos puros
 * Verifica los fixes P1/P2 aplicados en este bloque.
 */
import { describe, it, expect } from 'vitest';

// ─── FIX 1 — getPortalShellNavItems ──────────────────────────────────────────

import { getPortalShellNavItems, getLimitedPortalNavItems, getPortalNavItems } from '@/lib/portal/nav';

describe('getPortalShellNavItems', () => {
  it('hasProject=false → devuelve nav limitada (solo Soporte)', () => {
    const nav = getPortalShellNavItems({ hasProject: false, projectType: 'SUBSCRIPTION', projectId: 'p1' });
    expect(nav).toEqual(getLimitedPortalNavItems());
    expect(nav.some((n) => n.id === 'soporte')).toBe(true);
    expect(nav.some((n) => n.id === 'facturacion')).toBe(false);
    expect(nav.some((n) => n.id === 'proyecto')).toBe(false);
    expect(nav.some((n) => n.id === 'incidencias')).toBe(false);
    expect(nav.some((n) => n.id === 'misitio')).toBe(false);
    expect(nav.some((n) => n.id === 'mantenimiento')).toBe(false);
  });

  it('hasProject=false con cualquier projectType → siempre nav limitada', () => {
    for (const pt of ['SUBSCRIPTION', 'LEGACY', 'PORTFOLIO'] as const) {
      const nav = getPortalShellNavItems({ hasProject: false, projectType: pt, projectId: null });
      expect(nav.some((n) => n.id === 'proyecto')).toBe(false);
      expect(nav.some((n) => n.id === 'soporte')).toBe(true);
    }
  });

  it('hasProject=true + SUBSCRIPTION → nav completa SUBSCRIPTION', () => {
    const nav = getPortalShellNavItems({ hasProject: true, projectType: 'SUBSCRIPTION', projectId: 'p1' });
    const full = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: 'p1' });
    expect(nav).toEqual(full);
    expect(nav.some((n) => n.id === 'facturacion')).toBe(true);
    expect(nav.some((n) => n.id === 'incidencias')).toBe(true);
  });

  it('hasProject=true + LEGACY → nav completa LEGACY con Mantenimiento', () => {
    const nav = getPortalShellNavItems({ hasProject: true, projectType: 'LEGACY', projectId: 'p1' });
    expect(nav.some((n) => n.id === 'mantenimiento')).toBe(true);
    expect(nav.some((n) => n.id === 'facturacion')).toBe(true);
  });

  it('hasProject=true + PORTFOLIO → nav PORTFOLIO sin Facturación', () => {
    const nav = getPortalShellNavItems({ hasProject: true, projectType: 'PORTFOLIO', projectId: 'p1' });
    expect(nav.some((n) => n.id === 'facturacion')).toBe(false);
    expect(nav.some((n) => n.id === 'soporte')).toBe(true);
  });

  it('hasProject=false → sin Proyecto, Cambios, Incidencias, Facturación, Mantenimiento, Mi sitio', () => {
    const nav = getPortalShellNavItems({ hasProject: false, projectType: 'LEGACY', projectId: 'p1' });
    const forbidden = ['proyecto', 'cambios', 'incidencias', 'facturacion', 'mantenimiento', 'misitio'];
    for (const id of forbidden) {
      expect(nav.some((n) => n.id === id)).toBe(false);
    }
  });
});

// ─── FIX 2 — helpers de display (lógica pura) ─────────────────────────────────

import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects/state-machine';

function resolveIncidentProjectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? 'En activación';
}

function resolveIncidentProjectDisplayName(
  project: { productionUrl: string | null; domainTarget: string | null },
  index: number,
): string {
  return project.productionUrl ?? project.domainTarget ?? `Sitio ${index + 1}`;
}

describe('resolveIncidentProjectStatusLabel', () => {
  it('LIVE → "En vivo"', () => {
    expect(resolveIncidentProjectStatusLabel('LIVE')).toBe('En vivo');
  });

  it('STAGING_REVIEW → "Revisión de staging"', () => {
    expect(resolveIncidentProjectStatusLabel('STAGING_REVIEW')).toBe('Revisión de staging');
  });

  it('AWAITING_ASSETS → "Esperando materiales"', () => {
    expect(resolveIncidentProjectStatusLabel('AWAITING_ASSETS')).toBe('Esperando materiales');
  });

  it('status desconocido → "En activación"', () => {
    expect(resolveIncidentProjectStatusLabel('UNKNOWN_STATUS')).toBe('En activación');
  });

  it('string vacío → "En activación"', () => {
    expect(resolveIncidentProjectStatusLabel('')).toBe('En activación');
  });
});

describe('resolveIncidentProjectDisplayName', () => {
  it('productionUrl presente → usa productionUrl', () => {
    expect(resolveIncidentProjectDisplayName({ productionUrl: 'https://mi-sitio.com', domainTarget: 'otro.com' }, 0))
      .toBe('https://mi-sitio.com');
  });

  it('sin productionUrl pero con domainTarget → usa domainTarget', () => {
    expect(resolveIncidentProjectDisplayName({ productionUrl: null, domainTarget: 'mi-sitio.com' }, 0))
      .toBe('mi-sitio.com');
  });

  it('sin productionUrl ni domainTarget → "Sitio 1" para index 0', () => {
    expect(resolveIncidentProjectDisplayName({ productionUrl: null, domainTarget: null }, 0))
      .toBe('Sitio 1');
  });

  it('sin productionUrl ni domainTarget → "Sitio 3" para index 2', () => {
    expect(resolveIncidentProjectDisplayName({ productionUrl: null, domainTarget: null }, 2))
      .toBe('Sitio 3');
  });
});
