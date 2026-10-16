// Presentation tokens for client-facing material (asset) chips.
//
// Pure helpers — no DB, no React. Centralizes the labels and the sober,
// brand-aligned colors used by the materials experience so the chips read
// clearly and never rely on color alone (every chip carries human text).
//
// Design rules (QUIRICO premium dark):
//   - Requerido  → ámbar suave de marca (más visible que gris, nunca neón).
//   - Opcional   → neutral discreto (no compite con requerido).
//   - Pendiente  → ámbar/advertencia sobria (llama la atención sin gritar).
//   - Subido     → azul informativo (enviado, en espera de revisión).
//   - En revisión→ violeta (el admin lo está revisando).
//   - Recibido   → verde sobrio (éxito real).
//   - Requiere ajuste → rose contenido, humano, no alarmista.
//
// The brand accent is amber (#FF8C00 / soft #FFB347). Lime/neon (#d5ff02) is
// forbidden as a status or CTA color anywhere in the portal.

export type MaterialAssetStatus =
  | 'pending'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface MaterialChipStyle {
  label: string;
  /** Foreground (text) color. */
  text: string;
  /** Border color. */
  border: string;
  /** Background tint. */
  bg: string;
}

const REQUIRED_CHIP: MaterialChipStyle = {
  label: 'Requerido',
  text: '#FFB347',
  border: 'rgba(255,140,0,0.32)',
  bg: 'rgba(255,140,0,0.10)',
};

const OPTIONAL_CHIP: MaterialChipStyle = {
  label: 'Opcional',
  text: 'rgba(249,249,249,0.5)',
  border: 'rgba(255,255,255,0.14)',
  bg: 'rgba(255,255,255,0.04)',
};

const STATUS_CHIPS: Record<MaterialAssetStatus, MaterialChipStyle> = {
  pending: {
    label: 'Pendiente',
    text: '#FFB347',
    border: 'rgba(255,140,0,0.28)',
    bg: 'rgba(255,140,0,0.08)',
  },
  uploaded: {
    label: 'Subido',
    text: '#6B9FFF',
    border: 'rgba(107,159,255,0.28)',
    bg: 'rgba(107,159,255,0.10)',
  },
  under_review: {
    label: 'En revisión',
    text: '#D4B8FF',
    border: 'rgba(212,184,255,0.28)',
    bg: 'rgba(212,184,255,0.09)',
  },
  approved: {
    label: 'Recibido',
    text: '#5DD69C',
    border: 'rgba(93,214,156,0.30)',
    bg: 'rgba(93,214,156,0.10)',
  },
  rejected: {
    label: 'Requiere ajuste',
    text: '#F4A3A3',
    border: 'rgba(239,68,68,0.30)',
    bg: 'rgba(239,68,68,0.09)',
  },
};

/** Chip for whether a material is required or optional. */
export function getMaterialRequirementChip(required: boolean): MaterialChipStyle {
  return required ? REQUIRED_CHIP : OPTIONAL_CHIP;
}

/** Chip for the current upload/review status of a material. */
export function getMaterialStatusChip(status: MaterialAssetStatus): MaterialChipStyle {
  return STATUS_CHIPS[status] ?? STATUS_CHIPS.pending;
}
