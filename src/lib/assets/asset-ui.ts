import type { ProjectStatus } from '@/lib/projects/state-machine';
import type { ProjectType } from '@/lib/portal/project-type';
import type { AssetRequirement } from './asset-requirements';

// ─── Asset page mode ─────────────────────────────────────────────────────────

export type AssetPageMode = 'editable' | 'review' | 'locked';

const EDITABLE_STATUSES = new Set<ProjectStatus>(['AWAITING_ASSETS', 'ASSETS_INCOMPLETE']);
const REVIEW_STATUSES = new Set<ProjectStatus>(['ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW']);

export function getAssetPageMode(status: ProjectStatus): AssetPageMode {
  if (EDITABLE_STATUSES.has(status)) return 'editable';
  if (REVIEW_STATUSES.has(status)) return 'review';
  return 'locked';
}

// ─── Plan resolution ─────────────────────────────────────────────────────────

export function resolveAssetRequirementPlan(
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
  projectType: ProjectType,
): 'BASIC' | 'PRO' | 'BUSINESS' {
  if (projectType === 'PORTFOLIO') return 'BASIC';
  if (plan === 'LEGACY') return 'BASIC';
  return plan as 'BASIC' | 'PRO' | 'BUSINESS';
}

// ─── Asset progress ───────────────────────────────────────────────────────────

export interface AssetProgress {
  requiredTotal: number;
  requiredComplete: number;
  optionalTotal: number;
  optionalComplete: number;
  canSubmit: boolean;
}

interface AssetRecord {
  assetKey: string;
  status: string;
}

const COMPLETE_STATUSES = new Set(['uploaded', 'under_review', 'approved']);

function isRequirementComplete(req: AssetRequirement, assets: AssetRecord[]): boolean {
  if (req.minCount !== undefined) {
    const count = assets.filter(
      (a) => a.assetKey === req.key && COMPLETE_STATUSES.has(a.status),
    ).length;
    return count >= req.minCount;
  }
  return assets.some(
    (a) => a.assetKey === req.key && COMPLETE_STATUSES.has(a.status),
  );
}

export function getAssetProgress(
  requirements: AssetRequirement[],
  assets: AssetRecord[],
): AssetProgress {
  const required = requirements.filter((r) => r.required);
  const optional = requirements.filter((r) => !r.required);

  const requiredComplete = required.filter((r) => isRequirementComplete(r, assets)).length;
  const optionalComplete = optional.filter((r) => isRequirementComplete(r, assets)).length;

  return {
    requiredTotal: required.length,
    requiredComplete,
    optionalTotal: optional.length,
    optionalComplete,
    canSubmit: requiredComplete === required.length,
  };
}

/** Una sola entrada para saber si un requisito concreto ya está completo. */
export function isAssetRequirementComplete(
  req: AssetRequirement,
  assets: AssetRecord[],
): boolean {
  return isRequirementComplete(req, assets);
}

// ─── Subida de archivos: MIME + validación (compartido cliente) ───────────────

const MIME_MAP: Record<string, string[]> = {
  SVG: ['image/svg+xml'],
  PNG: ['image/png'],
  JPG: ['image/jpeg'],
  JPEG: ['image/jpeg'],
  WEBP: ['image/webp'],
  AI: ['application/postscript'],
  PDF: ['application/pdf'],
  DOCX: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  TXT: ['text/plain'],
  XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  CSV: ['text/csv'],
};

const MAX_ASSET_FILE_SIZES: Record<string, number> = {
  'image/jpeg': 25 * 1024 * 1024,
  'image/png': 25 * 1024 * 1024,
  'image/webp': 25 * 1024 * 1024,
  'image/svg+xml': 25 * 1024 * 1024,
  default: 50 * 1024 * 1024,
};

/** Atributo `accept` para el <input type=file> a partir de los formatos del requisito. */
export function getAcceptedAssetMimes(formats?: string[]): string {
  if (!formats || formats.length === 0) return '*/*';
  return formats.flatMap((f) => MIME_MAP[f] ?? []).join(',');
}

/** Devuelve un mensaje humano si el archivo no es válido, o null si lo es. */
export function validateAssetFile(file: File, formats?: string[]): string | null {
  if (formats && formats.length > 0) {
    const accepted = formats.flatMap((f) => MIME_MAP[f] ?? []);
    if (!accepted.includes(file.type)) {
      return `Formato no válido. Acepta: ${formats.join(', ')}`;
    }
  }
  const maxSize = MAX_ASSET_FILE_SIZES[file.type] ?? MAX_ASSET_FILE_SIZES.default;
  if (file.size > maxSize) {
    return `Archivo muy grande. Máximo: ${Math.round(maxSize / (1024 * 1024))}MB`;
  }
  return null;
}

/**
 * Requisito que debe quedar ACTIVO al abrir el paquete de materiales:
 *   1. el primer requerido pendiente (lo más urgente);
 *   2. si todos los requeridos están listos, el primer opcional pendiente;
 *   3. si todo está completo, el primer requisito de la lista (resumen/repaso).
 * Pura: la usan el componente y los tests. Devuelve null sólo si no hay requisitos.
 */
export function getInitialActiveRequirementKey(
  requirements: AssetRequirement[],
  assets: AssetRecord[],
): string | null {
  if (requirements.length === 0) return null;

  const firstPendingRequired = requirements.find(
    (r) => r.required && !isRequirementComplete(r, assets),
  );
  if (firstPendingRequired) return firstPendingRequired.key;

  const firstPendingOptional = requirements.find(
    (r) => !r.required && !isRequirementComplete(r, assets),
  );
  if (firstPendingOptional) return firstPendingOptional.key;

  return requirements[0].key;
}
