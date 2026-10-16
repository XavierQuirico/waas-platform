// ============================================================
// Auto-Save — WaaS Intake Wizard
// Persiste el borrador del wizard en localStorage (pre-pago,
// usuarios no autenticados — no hay DB row que contaminar)
// TTL: 48 horas desde último guardado
//
// Decisión de diseño: Se usa localStorage (no sessionStorage)
// para permitir que el usuario continúe el formulario en otra
// pestaña del mismo navegador o si cierra y reabre accidentalmente.
// Los datos se limpian automáticamente al completar el pago.
// ============================================================

import type { IntakeDraft, IntakeFormData, IntakeDraftV2, IntakeFormDataV2Final } from './types';
import { INTAKE_DRAFT_KEY, INTAKE_DRAFT_TTL_HOURS } from './types';

const INTAKE_DRAFT_V2_KEY = 'waas_intake_draft_v2';

/**
 * Guarda el borrador actual en localStorage.
 * Llamar en cada transición `onNext` del wizard.
 */
export function saveDraft(step: number, data: Partial<IntakeFormData>): void {
  if (typeof window === 'undefined') return;

  const draft: IntakeDraft = {
    version: 'v1',
    step,
    data,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Falla silenciosa — localStorage puede estar deshabilitado
  }
}

/**
 * Carga el borrador guardado, si existe y no ha expirado.
 * Retorna null si no hay draft o si expiró (>48h).
 */
export function loadDraft(): IntakeDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(INTAKE_DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as IntakeDraft;

    // Validar versión
    if (draft.version !== 'v1') {
      clearDraft();
      return null;
    }

    // Validar TTL
    const savedAt = new Date(draft.savedAt);
    const hoursElapsed = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > INTAKE_DRAFT_TTL_HOURS) {
      clearDraft();
      return null;
    }

    return draft;
  } catch {
    clearDraft();
    return null;
  }
}

/**
 * Elimina el borrador del localStorage.
 * Llamar después de envío exitoso o cuando el usuario elige "empezar de nuevo".
 */
export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INTAKE_DRAFT_KEY);
  } catch {
    // Falla silenciosa
  }
}

// ─── V2 Draft functions ───────────────────────────────────

/**
 * Guarda el borrador V2 en localStorage.
 * Usa una clave distinta a la v1 para no interferir con el wizard legacy.
 */
export function saveDraftV2(step: number, data: Partial<IntakeFormDataV2Final>): void {
  if (typeof window === 'undefined') return;

  const draft: IntakeDraftV2 = {
    version: 'v2',
    step,
    data,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(INTAKE_DRAFT_V2_KEY, JSON.stringify(draft));
  } catch {
    // Falla silenciosa
  }
}

/**
 * Carga el borrador V2, si existe y no ha expirado (>48h).
 * Retorna null si no hay draft, expiró, o el formato es incompatible.
 */
export function loadDraftV2(): IntakeDraftV2 | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(INTAKE_DRAFT_V2_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as IntakeDraftV2;

    if (draft.version !== 'v2') {
      clearDraftV2();
      return null;
    }

    const savedAt = new Date(draft.savedAt);
    const hoursElapsed = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > INTAKE_DRAFT_TTL_HOURS) {
      clearDraftV2();
      return null;
    }

    return draft;
  } catch {
    clearDraftV2();
    return null;
  }
}

/**
 * Elimina el borrador V2 del localStorage.
 */
export function clearDraftV2(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INTAKE_DRAFT_V2_KEY);
  } catch {
    // Falla silenciosa
  }
}
