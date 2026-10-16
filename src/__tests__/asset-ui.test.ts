import { describe, it, expect } from 'vitest';
import {
  getAssetPageMode,
  resolveAssetRequirementPlan,
  getAssetProgress,
} from '@/lib/assets/asset-ui';
import {
  canSubmitForReview,
  getMissingRequiredAssets,
} from '@/lib/assets/asset-requirements';
import {
  getProjectPhases,
  getProjectCurrentPhaseIndex,
  getProjectStatusBadge,
} from '@/lib/portal/dashboard-state';
import type { AssetRequirement } from '@/lib/assets/asset-requirements';

// ─── Test 1: resolveAssetRequirementPlan ─────────────────────────────────────

describe('resolveAssetRequirementPlan', () => {
  it('SUBSCRIPTION + BASIC returns BASIC', () => {
    expect(resolveAssetRequirementPlan('BASIC', 'SUBSCRIPTION')).toBe('BASIC');
  });

  it('SUBSCRIPTION + PRO returns PRO', () => {
    expect(resolveAssetRequirementPlan('PRO', 'SUBSCRIPTION')).toBe('PRO');
  });

  it('SUBSCRIPTION + BUSINESS returns BUSINESS', () => {
    expect(resolveAssetRequirementPlan('BUSINESS', 'SUBSCRIPTION')).toBe('BUSINESS');
  });

  it('LEGACY falls back to BASIC regardless of projectType', () => {
    expect(resolveAssetRequirementPlan('LEGACY', 'LEGACY')).toBe('BASIC');
  });

  it('PORTFOLIO with any plan falls back to BASIC', () => {
    expect(resolveAssetRequirementPlan('BASIC', 'PORTFOLIO')).toBe('BASIC');
    expect(resolveAssetRequirementPlan('PRO', 'PORTFOLIO')).toBe('BASIC');
    expect(resolveAssetRequirementPlan('BUSINESS', 'PORTFOLIO')).toBe('BASIC');
  });
});

// ─── Test 2: getAssetPageMode ─────────────────────────────────────────────────

describe('getAssetPageMode', () => {
  it('AWAITING_ASSETS is editable', () => {
    expect(getAssetPageMode('AWAITING_ASSETS')).toBe('editable');
  });

  it('ASSETS_INCOMPLETE is editable', () => {
    expect(getAssetPageMode('ASSETS_INCOMPLETE')).toBe('editable');
  });

  it('ASSETS_SUBMITTED is review', () => {
    expect(getAssetPageMode('ASSETS_SUBMITTED')).toBe('review');
  });

  it('ASSETS_UNDER_REVIEW is review', () => {
    expect(getAssetPageMode('ASSETS_UNDER_REVIEW')).toBe('review');
  });

  it('PRODUCTION_STARTED is locked', () => {
    expect(getAssetPageMode('PRODUCTION_STARTED')).toBe('locked');
  });

  it('STAGING_REVIEW is locked', () => {
    expect(getAssetPageMode('STAGING_REVIEW')).toBe('locked');
  });

  it('LIVE is locked', () => {
    expect(getAssetPageMode('LIVE')).toBe('locked');
  });

  it('CLOSED is locked', () => {
    expect(getAssetPageMode('CLOSED')).toBe('locked');
  });

  it('CANCELLED is locked', () => {
    expect(getAssetPageMode('CANCELLED')).toBe('locked');
  });
});

// ─── Test 3 & 4: getAssetProgress ────────────────────────────────────────────

const REQ_LOGO: AssetRequirement = { key: 'logo', label: 'Logo', required: true };
const REQ_PHOTOS: AssetRequirement = { key: 'photos', label: 'Fotos', required: true, minCount: 3 };
const REQ_BRIEF: AssetRequirement = { key: 'brief', label: 'Brief', required: false, type: 'textarea' };

const ALL_REQUIREMENTS = [REQ_LOGO, REQ_PHOTOS, REQ_BRIEF];

describe('getAssetProgress', () => {
  it('no assets → 0 required and 0 optional complete, canSubmit false', () => {
    const p = getAssetProgress(ALL_REQUIREMENTS, []);
    expect(p.requiredTotal).toBe(2);
    expect(p.requiredComplete).toBe(0);
    expect(p.optionalTotal).toBe(1);
    expect(p.optionalComplete).toBe(0);
    expect(p.canSubmit).toBe(false);
  });

  it('uploaded single required asset counts as complete', () => {
    const assets = [{ assetKey: 'logo', status: 'uploaded' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('approved single required asset counts as complete', () => {
    const assets = [{ assetKey: 'logo', status: 'approved' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('under_review single required asset counts as complete', () => {
    const assets = [{ assetKey: 'logo', status: 'under_review' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('rejected required asset does NOT count as complete', () => {
    const assets = [{ assetKey: 'logo', status: 'rejected' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(0);
    expect(p.canSubmit).toBe(false);
  });

  it('pending required asset does NOT count as complete', () => {
    const assets = [{ assetKey: 'logo', status: 'pending' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(0);
  });

  it('multi-file only complete when count >= minCount', () => {
    const twoPhotos = [
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
    ];
    const p2 = getAssetProgress(ALL_REQUIREMENTS, twoPhotos);
    expect(p2.requiredComplete).toBe(0); // 2 < 3, not complete

    const threePhotos = [...twoPhotos, { assetKey: 'photos', status: 'uploaded' }];
    const p3 = getAssetProgress(ALL_REQUIREMENTS, threePhotos);
    expect(p3.requiredComplete).toBe(1); // 3 >= 3, complete
  });

  it('optional asset uploaded counts optionalComplete', () => {
    const assets = [{ assetKey: 'brief', status: 'uploaded' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.optionalComplete).toBe(1);
  });

  it('optional pending does NOT count optionalComplete', () => {
    const assets = [{ assetKey: 'brief', status: 'pending' }];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.optionalComplete).toBe(0);
  });

  it('canSubmit true when all required complete', () => {
    const assets = [
      { assetKey: 'logo', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.canSubmit).toBe(true);
  });

  it('canSubmit false when any required incomplete', () => {
    const assets = [{ assetKey: 'logo', status: 'uploaded' }]; // missing photos
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.canSubmit).toBe(false);
  });

  it('canSubmit false when required has rejected status', () => {
    const assets = [
      { assetKey: 'logo', status: 'rejected' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.canSubmit).toBe(false);
  });

  it('rejected old + uploaded new counts as requiredComplete', () => {
    const assets = [
      { assetKey: 'logo', status: 'rejected' },
      { assetKey: 'logo', status: 'uploaded' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('pending old + approved new counts as requiredComplete', () => {
    const assets = [
      { assetKey: 'logo', status: 'pending' },
      { assetKey: 'logo', status: 'approved' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('unknown old + under_review new counts as requiredComplete', () => {
    const assets = [
      { assetKey: 'logo', status: 'some_unknown' },
      { assetKey: 'logo', status: 'under_review' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });

  it('multi-file: 2 uploaded + 1 rejected = incomplete (below minCount)', () => {
    const assets = [
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'rejected' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(0);
  });

  it('multi-file: 3 uploaded + 1 rejected = complete (has enough submittable)', () => {
    const assets = [
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'rejected' },
    ];
    const p = getAssetProgress(ALL_REQUIREMENTS, assets);
    expect(p.requiredComplete).toBe(1);
  });
});

// ─── Test 5: Project phases ───────────────────────────────────────────────────

describe('getProjectPhases', () => {
  it('SUBSCRIPTION has 7 phases', () => {
    expect(getProjectPhases('SUBSCRIPTION')).toHaveLength(7);
  });

  it('LEGACY has 6 phases', () => {
    expect(getProjectPhases('LEGACY')).toHaveLength(6);
  });

  it('PORTFOLIO has 5 phases', () => {
    expect(getProjectPhases('PORTFOLIO')).toHaveLength(5);
  });
});

describe('getProjectCurrentPhaseIndex', () => {
  it('AWAITING_ASSETS maps to Materiales (index 1) for SUBSCRIPTION', () => {
    expect(getProjectCurrentPhaseIndex('AWAITING_ASSETS', 'SUBSCRIPTION')).toBe(1);
  });

  it('STAGING_REVIEW maps to Preview (index 4) for SUBSCRIPTION', () => {
    expect(getProjectCurrentPhaseIndex('STAGING_REVIEW', 'SUBSCRIPTION')).toBe(4);
  });

  it('LIVE maps to last phase (index 6) for SUBSCRIPTION', () => {
    expect(getProjectCurrentPhaseIndex('LIVE', 'SUBSCRIPTION')).toBe(6);
  });

  it('AWAITING_ASSETS maps to Acuerdo (index 1) for LEGACY', () => {
    expect(getProjectCurrentPhaseIndex('AWAITING_ASSETS', 'LEGACY')).toBe(1);
  });

  it('LIVE maps to last phase (index 5) for LEGACY', () => {
    expect(getProjectCurrentPhaseIndex('LIVE', 'LEGACY')).toBe(5);
  });

  it('AWAITING_ASSETS maps to Materiales (index 1) for PORTFOLIO', () => {
    expect(getProjectCurrentPhaseIndex('AWAITING_ASSETS', 'PORTFOLIO')).toBe(1);
  });

  it('LIVE maps to last phase (index 4) for PORTFOLIO', () => {
    expect(getProjectCurrentPhaseIndex('LIVE', 'PORTFOLIO')).toBe(4);
  });
});

// ─── Test 6: getProjectStatusBadge ───────────────────────────────────────────

describe('getProjectStatusBadge', () => {
  it('AWAITING_ASSETS is amber with Materiales pendientes', () => {
    const badge = getProjectStatusBadge('AWAITING_ASSETS');
    expect(badge.type).toBe('amber');
    expect(badge.label).toBe('Materiales pendientes');
  });

  it('STAGING_REVIEW is blue with Preview listo', () => {
    const badge = getProjectStatusBadge('STAGING_REVIEW');
    expect(badge.type).toBe('blue');
    expect(badge.label).toBe('Preview listo');
  });

  it('LIVE is green with Publicado', () => {
    const badge = getProjectStatusBadge('LIVE');
    expect(badge.type).toBe('green');
    expect(badge.label).toBe('Publicado');
  });

  it('ASSETS_INCOMPLETE is amber with Necesita correcciones', () => {
    const badge = getProjectStatusBadge('ASSETS_INCOMPLETE');
    expect(badge.type).toBe('amber');
    expect(badge.label).toBe('Necesita correcciones');
  });

  it('CANCELLED is red', () => {
    const badge = getProjectStatusBadge('CANCELLED');
    expect(badge.type).toBe('red');
  });
});

// ─── Test 7: canSubmitForReview ───────────────────────────────────────────────

// BASIC requiere: logo, photos (min 3), copy_doc, brief
function buildCompleteBasicAssets(status: string) {
  return [
    { assetKey: 'logo', status },
    { assetKey: 'photos', status },
    { assetKey: 'photos', status },
    { assetKey: 'photos', status },
    { assetKey: 'copy_doc', status },
    { assetKey: 'brief', status },
  ];
}

describe('canSubmitForReview', () => {
  it('rejected required blocks submit', () => {
    const assets = [{ assetKey: 'logo', status: 'rejected' }];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('pending required blocks submit', () => {
    const assets = [{ assetKey: 'logo', status: 'pending' }];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('unknown status blocks submit', () => {
    const assets = [{ assetKey: 'logo', status: 'unknown_status' }];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('uploaded allows submit when all required complete', () => {
    expect(canSubmitForReview('BASIC', buildCompleteBasicAssets('uploaded'))).toBe(true);
  });

  it('under_review allows submit', () => {
    expect(canSubmitForReview('BASIC', buildCompleteBasicAssets('under_review'))).toBe(true);
  });

  it('approved allows submit', () => {
    expect(canSubmitForReview('BASIC', buildCompleteBasicAssets('approved'))).toBe(true);
  });

  it('multi-file: 2 uploaded + 1 rejected does NOT meet minCount=3', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'photos'),
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'rejected' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('multi-file: 2 uploaded + 1 pending does NOT meet minCount=3', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'photos'),
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'pending' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('multi-file: 3 uploaded meets minCount=3', () => {
    expect(canSubmitForReview('BASIC', buildCompleteBasicAssets('uploaded'))).toBe(true);
  });

  it('optional rejected does NOT block submit', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded'),
      { assetKey: 'hex_colors', status: 'rejected' }, // optional
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });

  it('rejected old + uploaded new counts as complete for unique asset', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'logo'),
      { assetKey: 'logo', status: 'rejected' },
      { assetKey: 'logo', status: 'uploaded' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });

  it('pending old + approved new counts as complete for unique asset', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'logo'),
      { assetKey: 'logo', status: 'pending' },
      { assetKey: 'logo', status: 'approved' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });

  it('unknown old + under_review new counts as complete for unique asset', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'logo'),
      { assetKey: 'logo', status: 'some_unknown' },
      { assetKey: 'logo', status: 'under_review' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });

  it('uploaded old + rejected new still counts as complete (has submittable version)', () => {
    const assets = [
      ...buildCompleteBasicAssets('uploaded').filter((a) => a.assetKey !== 'logo'),
      { assetKey: 'logo', status: 'uploaded' },
      { assetKey: 'logo', status: 'rejected' },
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });
});

// ─── Test 8: getMissingRequiredAssets ────────────────────────────────────────

describe('getMissingRequiredAssets', () => {
  it('rejected required appears as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'rejected' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(true);
  });

  it('pending required appears as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'pending' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(true);
  });

  it('unknown status appears as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'some_unknown' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(true);
  });

  it('uploaded does NOT appear as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'uploaded' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('under_review does NOT appear as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'under_review' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('approved does NOT appear as missing', () => {
    const missing = getMissingRequiredAssets('BASIC', [{ assetKey: 'logo', status: 'approved' }]);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('multi-file: 2 uploaded + 1 rejected does NOT complete minCount', () => {
    const assets = [
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'rejected' },
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'photos')).toBe(true);
  });

  it('multi-file: 3 uploaded does NOT appear as missing', () => {
    const assets = [
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
      { assetKey: 'photos', status: 'uploaded' },
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'photos')).toBe(false);
  });

  it('rejected old + uploaded new does NOT appear as missing', () => {
    const assets = [
      { assetKey: 'logo', status: 'rejected' },
      { assetKey: 'logo', status: 'uploaded' },
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('pending old + approved new does NOT appear as missing', () => {
    const assets = [
      { assetKey: 'logo', status: 'pending' },
      { assetKey: 'logo', status: 'approved' },
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('unknown old + under_review new does NOT appear as missing', () => {
    const assets = [
      { assetKey: 'logo', status: 'some_unknown' },
      { assetKey: 'logo', status: 'under_review' },
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'logo')).toBe(false);
  });

  it('rejected only still appears as missing', () => {
    const assets = [{ assetKey: 'logo', status: 'rejected' }];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.some((r) => r.key === 'logo')).toBe(true);
  });
});
