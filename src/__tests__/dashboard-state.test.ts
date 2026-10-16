import { describe, it, expect } from 'vitest';
import {
  derivePortalDashboardState,
  getPortalDashboardStatusConfig,
  getPortalDashboardSteps,
  getPortalDashboardCurrentStep,
  getProjectTypeLabel,
  getProjectDisplayName,
} from '@/lib/portal/dashboard-state';
import { getPortalNavItems } from '@/lib/portal/nav';
import type { ProjectType } from '@/lib/portal/project-type';

const base = { hasProject: true, stagingUrl: null, productionUrl: null, liveAt: null };

// ─── derivePortalDashboardState ───────────────────────────────────────────────

describe('derivePortalDashboardState', () => {
  it('sin proyecto → limited', () => {
    expect(
      derivePortalDashboardState({ ...base, status: 'DRAFT', projectType: 'SUBSCRIPTION', hasProject: false }),
    ).toBe('limited');
  });

  it('DRAFT → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'DRAFT', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('PROPOSAL_SENT → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'PROPOSAL_SENT', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('REQUIRES_REVIEW → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'REQUIRES_REVIEW', projectType: 'LEGACY' })).toBe('limited');
  });

  it('PAYMENT_RECEIVED → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'PAYMENT_RECEIVED', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('PROPOSAL_EXPIRED → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'PROPOSAL_EXPIRED', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('CANCELLED → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'CANCELLED', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('SUSPENDED → limited', () => {
    expect(derivePortalDashboardState({ ...base, status: 'SUSPENDED', projectType: 'SUBSCRIPTION' })).toBe('limited');
  });

  it('AWAITING_ASSETS → materials', () => {
    expect(derivePortalDashboardState({ ...base, status: 'AWAITING_ASSETS', projectType: 'SUBSCRIPTION' })).toBe('materials');
  });

  it('ASSETS_INCOMPLETE → materials', () => {
    expect(derivePortalDashboardState({ ...base, status: 'ASSETS_INCOMPLETE', projectType: 'SUBSCRIPTION' })).toBe('materials');
  });

  it('ASSETS_SUBMITTED → review', () => {
    expect(derivePortalDashboardState({ ...base, status: 'ASSETS_SUBMITTED', projectType: 'SUBSCRIPTION' })).toBe('review');
  });

  it('ASSETS_UNDER_REVIEW → review', () => {
    expect(derivePortalDashboardState({ ...base, status: 'ASSETS_UNDER_REVIEW', projectType: 'SUBSCRIPTION' })).toBe('review');
  });

  it('PRODUCTION_STARTED → building', () => {
    expect(derivePortalDashboardState({ ...base, status: 'PRODUCTION_STARTED', projectType: 'SUBSCRIPTION' })).toBe('building');
  });

  it('REVISIONS → building', () => {
    expect(derivePortalDashboardState({ ...base, status: 'REVISIONS', projectType: 'SUBSCRIPTION' })).toBe('building');
  });

  it('REVISIONS_DONE → building', () => {
    expect(derivePortalDashboardState({ ...base, status: 'REVISIONS_DONE', projectType: 'SUBSCRIPTION' })).toBe('building');
  });

  it('STAGING_REVIEW → preview', () => {
    expect(derivePortalDashboardState({ ...base, status: 'STAGING_REVIEW', projectType: 'SUBSCRIPTION' })).toBe('preview');
  });

  it('LIVE → active', () => {
    expect(derivePortalDashboardState({ ...base, status: 'LIVE', projectType: 'SUBSCRIPTION' })).toBe('active');
  });

  it('CLOSED + LEGACY → active', () => {
    expect(derivePortalDashboardState({ ...base, status: 'CLOSED', projectType: 'LEGACY' })).toBe('active');
  });

  it('CLOSED + PORTFOLIO → active', () => {
    expect(derivePortalDashboardState({ ...base, status: 'CLOSED', projectType: 'PORTFOLIO' })).toBe('active');
  });
});

// ─── getPortalDashboardStatusConfig ──────────────────────────────────────────

describe('getPortalDashboardStatusConfig', () => {
  it('materials cta1 → /onboarding/assets', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'materials',
      status: 'AWAITING_ASSETS',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta1?.href).toBe('/onboarding/assets');
  });

  it('preview usa stagingUrl como cta1 cuando existe', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'preview',
      status: 'STAGING_REVIEW',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: 'https://preview.example.com',
      productionUrl: null,
    });
    expect(cfg.cta1?.href).toBe('https://preview.example.com');
    expect(cfg.cta1?.external).toBe(true);
  });

  it('preview normaliza stagingUrl sin protocolo a https://', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'preview',
      status: 'STAGING_REVIEW',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: 'preview.example.com',
      productionUrl: null,
    });
    expect(cfg.cta1?.href).toBe('https://preview.example.com');
    expect(cfg.cta1?.external).toBe(true);
  });

  it('preview sin stagingUrl usa href de fallback a /proyecto/:id/staging', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'preview',
      status: 'STAGING_REVIEW',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta1?.href).toBe('/proyecto/p1/staging');
    expect(cfg.cta1?.external).toBeUndefined();
  });

  it('active cta1 → /mi-sitio', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'active',
      status: 'LIVE',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: 'https://sitio.com',
    });
    expect(cfg.cta1?.href).toBe('/mi-sitio');
  });

  it('PORTFOLIO active no propone /cambios-y-mejoras', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'active',
      status: 'LIVE',
      projectType: 'PORTFOLIO',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta2?.href).not.toBe('/cambios-y-mejoras');
    expect(cfg.cta2?.href).toBe('/soporte');
  });

  it('SUSPENDED cta1 → /facturacion', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'limited',
      status: 'SUSPENDED',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta1?.href).toBe('/facturacion');
  });

  it('SUSPENDED cta2 incluye WhatsApp', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'limited',
      status: 'SUSPENDED',
      projectType: 'SUBSCRIPTION',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta2?.href).toContain('wa.me');
  });

  it('LEGACY active cta2 → /mantenimiento', () => {
    const cfg = getPortalDashboardStatusConfig({
      visualState: 'active',
      status: 'LIVE',
      projectType: 'LEGACY',
      projectId: 'p1',
      stagingUrl: null,
      productionUrl: null,
    });
    expect(cfg.cta2?.href).toBe('/mantenimiento');
  });
});

// ─── Steps ───────────────────────────────────────────────────────────────────

describe('getPortalDashboardSteps', () => {
  it('SUBSCRIPTION tiene 5 pasos', () => {
    expect(getPortalDashboardSteps('SUBSCRIPTION')).toHaveLength(5);
  });

  it('LEGACY tiene 5 pasos', () => {
    expect(getPortalDashboardSteps('LEGACY')).toHaveLength(5);
  });

  it('PORTFOLIO tiene 5 pasos', () => {
    expect(getPortalDashboardSteps('PORTFOLIO')).toHaveLength(5);
  });
});

describe('getPortalDashboardCurrentStep', () => {
  it('limited → 1', () => { expect(getPortalDashboardCurrentStep('limited')).toBe(1); });
  it('materials → 2', () => { expect(getPortalDashboardCurrentStep('materials')).toBe(2); });
  it('review → 2', () => { expect(getPortalDashboardCurrentStep('review')).toBe(2); });
  it('building → 3', () => { expect(getPortalDashboardCurrentStep('building')).toBe(3); });
  it('preview → 4', () => { expect(getPortalDashboardCurrentStep('preview')).toBe(4); });
  it('active → 5', () => { expect(getPortalDashboardCurrentStep('active')).toBe(5); });
});

// ─── Áreas del portal ─────────────────────────────────────────────────────────

describe('áreas del portal desde getPortalNavItems', () => {
  it('SUBSCRIPTION incluye Facturación', () => {
    const areas = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: 'p1' }).filter((i) => i.id !== 'inicio');
    expect(areas.some((a) => a.id === 'facturacion')).toBe(true);
  });

  it('LEGACY incluye Mantenimiento', () => {
    const areas = getPortalNavItems({ projectType: 'LEGACY', projectId: 'p1' }).filter((i) => i.id !== 'inicio');
    expect(areas.some((a) => a.id === 'mantenimiento')).toBe(true);
  });

  it('PORTFOLIO no incluye Facturación', () => {
    const areas = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'p1' }).filter((i) => i.id !== 'inicio');
    expect(areas.some((a) => a.id === 'facturacion')).toBe(false);
  });

  it('Ninguna área tiene id inicio tras filtrado', () => {
    const types: ProjectType[] = ['SUBSCRIPTION', 'LEGACY', 'PORTFOLIO'];
    for (const pt of types) {
      const areas = getPortalNavItems({ projectType: pt, projectId: 'p1' }).filter((i) => i.id !== 'inicio');
      expect(areas.some((a) => a.id === 'inicio')).toBe(false);
    }
  });

  it('Ninguna href comienza con /portal/', () => {
    const types: ProjectType[] = ['SUBSCRIPTION', 'LEGACY', 'PORTFOLIO'];
    for (const pt of types) {
      getPortalNavItems({ projectType: pt, projectId: 'p1' }).forEach((item) => {
        expect(item.href.startsWith('/portal/')).toBe(false);
      });
    }
  });
});

// ─── Display names ────────────────────────────────────────────────────────────

describe('getProjectDisplayName', () => {
  it('un solo proyecto → Sitio principal', () => {
    expect(getProjectDisplayName({ index: 0, total: 1 })).toBe('Sitio principal');
  });

  it('múltiples proyectos usan hostname humano, nunca el UUID', () => {
    const name = getProjectDisplayName({
      index: 0,
      total: 3,
      productionUrl: 'https://www.mi-negocio.com/',
    });
    expect(name).toBe('mi-negocio.com');
    expect(name).not.toContain('#');
  });

  it('múltiples sin ninguna URL → fallback Sitio N (jamás Proyecto #)', () => {
    const name = getProjectDisplayName({ index: 1, total: 3 });
    expect(name).toBe('Sitio 2');
    expect(name).not.toContain('#');
  });
});

describe('getProjectTypeLabel', () => {
  it('portfolioFlag → Proyecto portfolio', () => {
    expect(getProjectTypeLabel('BASIC', true)).toBe('Proyecto portfolio');
  });

  it('LEGACY sin portfolioFlag → Proyecto legacy', () => {
    expect(getProjectTypeLabel('LEGACY', false)).toBe('Proyecto legacy');
  });

  it('BASIC sin portfolioFlag → Plan Basic', () => {
    expect(getProjectTypeLabel('BASIC', false)).toBe('Plan Basic');
  });

  it('PRO sin portfolioFlag → Plan Pro', () => {
    expect(getProjectTypeLabel('PRO', false)).toBe('Plan Pro');
  });

  it('BUSINESS sin portfolioFlag → Plan Business', () => {
    expect(getProjectTypeLabel('BUSINESS', false)).toBe('Plan Business');
  });
});
