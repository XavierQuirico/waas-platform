import { describe, it, expect } from 'vitest';
import type { ProjectStatus } from '@/lib/projects/state-machine';
import type { ProjectType } from '@/lib/portal/project-type';
import { getPortalProjectDisplayName } from '@/lib/portal/project-display';
import {
  getMaterialRequirementChip,
  getMaterialStatusChip,
  type MaterialAssetStatus,
} from '@/lib/portal/material-chips';
import { getProjectStatusBadge, getProjectPhases, getProjectCurrentPhaseIndex } from '@/lib/portal/dashboard-state';
import {
  derivePortalStagingVisualState,
  getPortalStagingCopy,
  type PortalStagingVisualState,
  type StagingFeedbackSummary,
} from '@/lib/portal/staging-state';
import { toExternalUrl } from '@/lib/portal/url';
import { ASSET_REQUIREMENTS, canSubmitForReview } from '@/lib/assets/asset-requirements';
import {
  getAssetProgress,
  getInitialActiveRequirementKey,
  isAssetRequirementComplete,
} from '@/lib/assets/asset-ui';

// ─── Contract: the client never sees raw technical state tokens or IDs ────────

const ALL_STATUSES: ProjectStatus[] = [
  'DRAFT',
  'PROPOSAL_SENT',
  'REQUIRES_REVIEW',
  'PAYMENT_RECEIVED',
  'PROPOSAL_EXPIRED',
  'AWAITING_ASSETS',
  'ASSETS_INCOMPLETE',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'LIVE',
  'CLOSED',
  'SUSPENDED',
  'CANCELLED',
];

const PROJECT_TYPES: ProjectType[] = ['SUBSCRIPTION', 'LEGACY', 'PORTFOLIO'];

// Raw machine tokens that must never appear in any client-facing string.
const FORBIDDEN_TOKENS = [
  'STAGING_REVIEW',
  'AWAITING_ASSETS',
  'ASSETS_INCOMPLETE',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'PRODUCTION_STARTED',
  'REVISIONS_DONE',
  'PROPOSAL_SENT',
  'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED',
  'REQUIRES_REVIEW',
  'Proyecto #',
  'context=portal',
  'context=admin',
  'LM04',
  'LM05',
  'undefined',
  'null',
];

function assertNoForbidden(value: string) {
  for (const token of FORBIDDEN_TOKENS) {
    expect(value, `"${value}" leaks forbidden token "${token}"`).not.toContain(token);
  }
}

describe('status badge labels are human', () => {
  it('every project status maps to a human badge with no raw tokens', () => {
    for (const status of ALL_STATUSES) {
      const badge = getProjectStatusBadge(status);
      expect(badge.label.length).toBeGreaterThan(0);
      assertNoForbidden(badge.label);
      // badge label is not just the raw status echoed back
      expect(badge.label).not.toBe(status);
    }
  });

  it('badge type is always a known design token', () => {
    const allowed = new Set(['neutral', 'amber', 'violet', 'blue', 'green', 'red']);
    for (const status of ALL_STATUSES) {
      expect(allowed.has(getProjectStatusBadge(status).type)).toBe(true);
    }
  });
});

describe('phase bar progression', () => {
  it('current phase index stays inside the phase array for every status/type', () => {
    for (const projectType of PROJECT_TYPES) {
      const phases = getProjectPhases(projectType);
      for (const status of ALL_STATUSES) {
        const idx = getProjectCurrentPhaseIndex(status, projectType);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(phases.length);
      }
    }
    for (const projectType of PROJECT_TYPES) {
      for (const phase of getProjectPhases(projectType)) {
        assertNoForbidden(phase.label);
      }
    }
  });
});

describe('staging copy distinguishes revision phases', () => {
  const noFeedback: StagingFeedbackSummary = {
    count: 0,
    lastSubmittedAt: null,
    lastAllApproved: null,
    lastHasChanges: false,
  };

  it('REVISIONS maps to in-progress, REVISIONS_DONE maps to done — not the same copy', () => {
    const inProgress = derivePortalStagingVisualState({ status: 'REVISIONS', feedback: noFeedback });
    const done = derivePortalStagingVisualState({ status: 'REVISIONS_DONE', feedback: noFeedback });
    expect(inProgress).toBe('revisions_in_progress');
    expect(done).toBe('revisions_done');

    const inProgressCopy = getPortalStagingCopy(inProgress);
    const doneCopy = getPortalStagingCopy(done);
    expect(inProgressCopy.title).not.toBe(doneCopy.title);
    // in-progress must communicate work happening, not "ready to review"
    expect(inProgressCopy.title.toLowerCase()).toContain('aplicando');
  });

  it('every staging visual state copy is human with no raw tokens', () => {
    const states: PortalStagingVisualState[] = [
      'ready',
      'approved',
      'feedback_sent',
      'revisions_in_progress',
      'revisions_done',
      'live',
      'closed',
      'unavailable',
    ];
    for (const state of states) {
      const copy = getPortalStagingCopy(state);
      assertNoForbidden(copy.badge);
      assertNoForbidden(copy.title);
      assertNoForbidden(copy.description);
      expect(copy.title.length).toBeGreaterThan(0);
    }
  });

  it('feedback already sent for the round disables a second submission round', () => {
    const sent: StagingFeedbackSummary = {
      count: 1,
      lastSubmittedAt: new Date(),
      lastAllApproved: false,
      lastHasChanges: true,
    };
    expect(derivePortalStagingVisualState({ status: 'STAGING_REVIEW', feedback: sent })).toBe('feedback_sent');
  });

  it('approval recorded for the round shows approved (no re-approve)', () => {
    const approved: StagingFeedbackSummary = {
      count: 1,
      lastSubmittedAt: new Date(),
      lastAllApproved: true,
      lastHasChanges: false,
    };
    expect(derivePortalStagingVisualState({ status: 'STAGING_REVIEW', feedback: approved })).toBe('approved');
  });
});

describe('external preview links are safe', () => {

  it('neutralizes dangerous schemes by forcing https prefix', () => {
    const out = toExternalUrl('javascript:alert(1)');
    expect(out?.startsWith('https://')).toBe(true);
    expect(out?.startsWith('javascript:')).toBe(false);
  });
});

// ─── A correctivo ─────────────────────────────────────────────────────

describe('project human label is multi-project safe', () => {
  it('single project always shows "Sitio principal"', () => {
    expect(
      getPortalProjectDisplayName({ index: 0, total: 1, productionUrl: null, stagingUrl: null }),
    ).toBe('Sitio principal');
    // Even if it has URLs, a single project stays "Sitio principal".
    expect(
      getPortalProjectDisplayName({
        index: 0,
        total: 1,
        productionUrl: 'https://acme.com',
        stagingUrl: 'https://staging.acme.com',
      }),
    ).toBe('Sitio principal');
  });

  it('multi-project with no usable URL falls back to "Sitio N" (1-based)', () => {
    expect(
      getPortalProjectDisplayName({ index: 1, total: 2, productionUrl: null, stagingUrl: null }),
    ).toBe('Sitio 2');
  });

  it('never leaks a UUID, hex fragment, or "Proyecto #" label', () => {
    const uuid = 'd382a4c1-1111-2222-3333-444455556666';
    for (const total of [1, 2, 5]) {
      for (let index = 0; index < total; index++) {
        const label = getPortalProjectDisplayName({
          index,
          total,
          // A leaked internal id in a URL field must be rejected by the helper.
          productionUrl: uuid,
          domainTarget: 'd382a4',
          stagingUrl: null,
        });
        assertNoForbidden(label);
        expect(UUID_FRAGMENT_RE.test(label)).toBe(false);
        expect(label).not.toBe(uuid);
      }
    }
  });
});

// v4 UUID or bare hex blob — must never surface as a visible label.
const UUID_FRAGMENT_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|^[0-9a-f]{6,32}$/i;

describe('material chips are human, contrasted and brand-amber (no neon)', () => {
  const STATUSES: MaterialAssetStatus[] = [
    'pending',
    'uploaded',
    'under_review',
    'approved',
    'rejected',
  ];

  it('status chips have human labels including Pendiente / Subido / Requiere ajuste', () => {
    const labels = STATUSES.map((s) => getMaterialStatusChip(s).label);
    expect(getMaterialStatusChip('pending').label).toBe('Pendiente');
    expect(getMaterialStatusChip('uploaded').label).toBe('Subido');
    expect(getMaterialStatusChip('approved').label).toBe('Recibido');
    expect(getMaterialStatusChip('rejected').label).toBe('Requiere ajuste');
    // No empty labels, and never an alarmist/raw token.
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      assertNoForbidden(label);
    }
  });

  it('pending is amber/warning (not invisible gray), success only for real success', () => {
    expect(getMaterialStatusChip('pending').text.toUpperCase()).toContain('FFB347');
    // Success green reserved for "Recibido".
    expect(getMaterialStatusChip('approved').text.toUpperCase()).toContain('5DD69C');
  });

  it('no chip uses lime/neon (#d5ff02) as a color', () => {
    const all = [
      getMaterialRequirementChip(true),
      getMaterialRequirementChip(false),
      ...STATUSES.map((s) => getMaterialStatusChip(s)),
    ];
    for (const chip of all) {
      const serialized = JSON.stringify(chip).toLowerCase();
      expect(serialized).not.toContain('d5ff02');
    }
  });
});

// ─── paquete de materiales (upload package) ───────────────────────

describe('paquete de materiales: progreso y requisito activo', () => {
  const reqs = ASSET_REQUIREMENTS.BASIC;
  const uploaded = (assetKey: string, n = 1) =>
    Array.from({ length: n }, () => ({ assetKey, status: 'uploaded' }));

  it('el activo inicial es el primer requerido pendiente (sin assets → logo)', () => {
    expect(getInitialActiveRequirementKey(reqs, [])).toBe('logo');
  });

  it('cuando un requerido está listo, el activo avanza a otro requerido pendiente', () => {
    const active = getInitialActiveRequirementKey(reqs, uploaded('logo'));
    expect(active).not.toBe('logo');
    const req = reqs.find((r) => r.key === active)!;
    expect(req.required).toBe(true);
  });

  it('si todos los requeridos están listos, el activo es el primer opcional', () => {
    const assets = reqs
      .filter((r) => r.required)
      .flatMap((r) => uploaded(r.key, r.minCount ?? 1));
    const active = getInitialActiveRequirementKey(reqs, assets);
    const req = reqs.find((r) => r.key === active)!;
    expect(req.required).toBe(false);
  });

  it('"X de Y requeridos" refleja el progreso real', () => {
    const empty = getAssetProgress(reqs, []);
    expect(empty.requiredComplete).toBe(0);
    expect(empty.requiredTotal).toBeGreaterThan(0);
    const partial = getAssetProgress(reqs, uploaded('logo'));
    expect(partial.requiredComplete).toBe(1);
  });

  it('el envío está deshabilitado hasta completar requeridos; rejected/pending no cuentan', () => {
    expect(canSubmitForReview('BASIC', [])).toBe(false);
    // un único requerido no basta: faltan los demás
    expect(canSubmitForReview('BASIC', uploaded('logo'))).toBe(false);
    const logo = reqs.find((r) => r.key === 'logo')!;
    expect(isAssetRequirementComplete(logo, [{ assetKey: 'logo', status: 'rejected' }])).toBe(false);
    expect(isAssetRequirementComplete(logo, [{ assetKey: 'logo', status: 'pending' }])).toBe(false);
    expect(isAssetRequirementComplete(logo, [{ assetKey: 'logo', status: 'uploaded' }])).toBe(true);
  });

  it('el catálogo separa requeridos de opcionales', () => {
    expect(reqs.some((r) => r.required)).toBe(true);
    expect(reqs.some((r) => !r.required)).toBe(true);
  });
});
