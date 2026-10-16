'use server';
// ============================================================
// Server Action — Catalog Calculator Data
// expone getCatalogForCalculator como server action
// para que el cliente (page.tsx 'use client') pueda acceder.
// añade getCatalogAISummaryAction para IA DB-first.
// ============================================================

import { getCatalogForCalculator } from '@/lib/catalog/catalog-loader';
import type { SubscriptionPlan, CalculatorCatalogResult } from '@/lib/catalog/types';
import { isAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/admin/auth';

export type CatalogCalculatorActionResult =
  | { success: true; data: CalculatorCatalogResult }
  | { success: false; error: string };

/**
 * Devuelve los ítems del catálogo clasificados por bloque
 * (included / paid / quoteRequired / unavailable) para el plan dado.
 * Solo relevante para proyectos de suscripción.
 * Falla silenciosamente si el catálogo no está disponible.
 */
export async function getCatalogBreakdownAction(
  plan: SubscriptionPlan
): Promise<CatalogCalculatorActionResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const data = await getCatalogForCalculator(plan);
    return { success: true, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: msg };
  }
}

export type CatalogAISummaryResult =
  | { success: true; summary: string; validCodes: string[] }
  | { success: false; error: string };

/**
 * Genera el resumen del catálogo para el prompt de IA desde DB-first.
 * Incluye solo los ítems visibles en calculadora y con precio (paid/fixed).
 * Usa fallback al seed si DB no responde.
 * El resultado incluye validCodes para filtrar sugerencias de Groq.
 */
export async function getCatalogAISummaryAction(
  plan?: SubscriptionPlan
): Promise<CatalogAISummaryResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    // Para proyectos sin plan (LEGACY o sin selección), usar plan BUSINESS
    // para tener el catálogo más completo como base del prompt.
    const effectivePlan = (plan?.toUpperCase() as SubscriptionPlan | undefined) ?? 'BUSINESS';
    const breakdown = await getCatalogForCalculator(effectivePlan);

    // Solo ítems visibles con precio fijo — los que la IA puede sugerir como add-ons
    const paidItems = breakdown.paid.filter((item) => item.priceCents != null && item.priceCents > 0);
    // Items incluidos también listados (para que la IA no los re-sugiera como cobrables)
    const includedItems = breakdown.included;

    const summary = [
      '# Capacidades con precio (add-ons cobrables)',
      ...paidItems.map((item) => `"${item.code}": ${item.name} ($${Math.round((item.priceCents ?? 0) / 100)})`),
      '',
      '# Capacidades incluidas en el plan (no cobrar como add-on)',
      ...includedItems.map((item) => `"${item.code}": ${item.name} [INCLUIDO]`),
    ].join('\n');

    const validCodes = [
      ...paidItems.map((item) => item.code),
      ...includedItems.map((item) => item.code),
      ...breakdown.quoteRequired.map((item) => item.code),
    ];

    return { success: true, summary, validCodes };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: msg };
  }
}

