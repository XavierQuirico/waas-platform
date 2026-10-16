import { describe, it, expect } from 'vitest';
import {
  canSubmitForReview,
  getMissingRequiredAssets,
  ASSET_REQUIREMENTS,
} from '@/lib/assets/asset-requirements';

type AssetRecord = { assetKey: string; status: string };

function uploaded(key: string, count = 1): AssetRecord[] {
  return Array.from({ length: count }, () => ({
    assetKey: key,
    status: 'uploaded',
  }));
}

const basicCompleteAssets: AssetRecord[] = [
  ...uploaded('logo'),
  ...uploaded('photos', 3),
  ...uploaded('copy_doc'),
  ...uploaded('brief'),
];

describe('canSubmitForReview — BASIC', () => {
  it('assets completos → true', () => {
    expect(canSubmitForReview('BASIC', basicCompleteAssets)).toBe(true);
  });

  it('sin logo → false', () => {
    const assets = basicCompleteAssets.filter((a) => a.assetKey !== 'logo');
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('solo 2 fotos (mínimo 3) → false', () => {
    const assets = [
      ...uploaded('logo'),
      ...uploaded('photos', 2),
      ...uploaded('copy_doc'),
      ...uploaded('brief'),
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('exactamente 3 fotos → true', () => {
    expect(canSubmitForReview('BASIC', basicCompleteAssets)).toBe(true);
  });

  it('5 fotos → true (más del mínimo)', () => {
    const assets = [
      ...uploaded('logo'),
      ...uploaded('photos', 5),
      ...uploaded('copy_doc'),
      ...uploaded('brief'),
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(true);
  });

  it('fotos en estado pending → no cuentan', () => {
    const assets = [
      ...uploaded('logo'),
      { assetKey: 'photos', status: 'pending' },
      { assetKey: 'photos', status: 'pending' },
      { assetKey: 'photos', status: 'pending' },
      ...uploaded('copy_doc'),
      ...uploaded('brief'),
    ];
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('sin brief → false', () => {
    const assets = basicCompleteAssets.filter((a) => a.assetKey !== 'brief');
    expect(canSubmitForReview('BASIC', assets)).toBe(false);
  });

  it('hex_colors opcional: sin él → true (es opcional)', () => {
    expect(canSubmitForReview('BASIC', basicCompleteAssets)).toBe(true);
  });

  it('lista vacía → false', () => {
    expect(canSubmitForReview('BASIC', [])).toBe(false);
  });
});

describe('canSubmitForReview — BUSINESS', () => {
  it('BUSINESS requiere product_data', () => {
    // basicCompleteAssets no tiene product_data
    expect(canSubmitForReview('BUSINESS', basicCompleteAssets)).toBe(false);
  });

  it('BUSINESS con product_data → true', () => {
    const assets = [...basicCompleteAssets, ...uploaded('product_data')];
    expect(canSubmitForReview('BUSINESS', assets)).toBe(true);
  });
});

describe('getMissingRequiredAssets', () => {
  it('assets completos → array vacío', () => {
    expect(getMissingRequiredAssets('BASIC', basicCompleteAssets)).toHaveLength(0);
  });

  it('sin logo → retorna logo como faltante', () => {
    const assets = basicCompleteAssets.filter((a) => a.assetKey !== 'logo');
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.map((r) => r.key)).toContain('logo');
  });

  it('solo 1 foto → fotos como faltante', () => {
    const assets = [
      ...uploaded('logo'),
      ...uploaded('photos', 1),
      ...uploaded('copy_doc'),
      ...uploaded('brief'),
    ];
    const missing = getMissingRequiredAssets('BASIC', assets);
    expect(missing.map((r) => r.key)).toContain('photos');
  });

  it('lista vacía → todos los requeridos son faltantes', () => {
    const missing = getMissingRequiredAssets('BASIC', []);
    const requiredKeys = ASSET_REQUIREMENTS.BASIC.filter((r) => r.required).map((r) => r.key);
    for (const key of requiredKeys) {
      expect(missing.map((r) => r.key)).toContain(key);
    }
  });

  it('BUSINESS sin product_data → product_data en faltantes', () => {
    const missing = getMissingRequiredAssets('BUSINESS', basicCompleteAssets);
    expect(missing.map((r) => r.key)).toContain('product_data');
  });
});

describe('ASSET_REQUIREMENTS structure', () => {
  it('BASIC tiene al menos 4 assets requeridos', () => {
    const required = ASSET_REQUIREMENTS.BASIC.filter((r) => r.required);
    expect(required.length).toBeGreaterThanOrEqual(4);
  });

  it('BUSINESS tiene más requeridos que BASIC', () => {
    const basicReq = ASSET_REQUIREMENTS.BASIC.filter((r) => r.required).length;
    const businessReq = ASSET_REQUIREMENTS.BUSINESS.filter((r) => r.required).length;
    expect(businessReq).toBeGreaterThan(basicReq);
  });
});
