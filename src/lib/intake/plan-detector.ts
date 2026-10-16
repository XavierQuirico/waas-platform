// ============================================================
// Plan Detector — WaaS
// Función pura: FeatureChecklist → PlanDetectionResult
// SIN IA — determinístico al 100%
// suggestedAddOns devuelve códigos de catálogo.
// ADD_ONS hardcodeado se mantiene como fallback de display
// SOLO en flujos legacy que lean suggestedAddOns de DB.
// Nuevos proyectos reciben suggestedAddOns = null en DB.
// ============================================================

import type {
  FeatureChecklist,
  PlanDetectionResult,
  AddOnSuggestion,
  MaterialStatus,
} from './types';

/**
 * Mapping de funcionalidades del intake a códigos de catálogo.
 * Mantiene label/price para compatibilidad de display con flujos existentes
 * que aún lean suggestedAddOns de DB en proyectos viejos.
 *
 * para proyectos nuevos, suggestedAddOns en DB queda null.
 * Las sugerencias reales vienen desde getCatalogSnapshotForProposal().
 */
const ADD_ONS: Record<string, AddOnSuggestion & { catalogCode: string }> = {
  C01_copywriting: {
    key: 'C01_copywriting',
    label: 'Redacción profesional de textos (IA + revisión humana)',
    priceUsd: 149,
    reason: 'No tienes los textos de tu sitio listos — podemos encargarnos por ti.',
    catalogCode: 'C01',
  },
  C02_blog_engine: {
    key: 'C02_blog_engine',
    label: 'Blog / sección de noticias activado',
    priceUsd: 129,
    reason: 'Seleccionaste que necesitas blog o sección de noticias.',
    catalogCode: 'C02A',
  },
  I01_crm_sync: {
    key: 'I01_crm_sync',
    label: 'Integración CRM (HubSpot, Zoho, Mailchimp)',
    priceUsd: 99,
    reason: 'Seleccionaste integración con tu CRM.',
    catalogCode: 'I01',
  },
  I02_advanced_booking: {
    key: 'I02_advanced_booking',
    label: 'Sistema de agenda con múltiples empleados',
    priceUsd: 129,
    reason: 'Seleccionaste agenda con múltiples empleados o colaboradores.',
    catalogCode: 'I02',
  },
} as const;

/**
 * Detecta el plan base y sugiere add-ons a partir del checklist de funcionalidades.
 *
 * Prioridad del plan (primer match gana):
 * 1. wantsOwnership → LEGACY (requiresReview: true)
 * 2. checkout OR catalog → BUSINESS
 * 3. booking → PRO
 * 4. else → BASIC
 *
 * Los add-ons (blog, CRM, multi-empleados) NO cambian el plan base.
 */
export function detectPlan(
  features: FeatureChecklist,
  materialStatus?: MaterialStatus
): PlanDetectionResult {
  const reasons: string[] = [];
  const suggestedAddOns: AddOnSuggestion[] = [];

  // ─── Detectar plan base ───────────────────────────────
  let plan: PlanDetectionResult['plan'];

  if (features.wantsOwnership) {
    plan = 'LEGACY';
    reasons.push('Quieres ser dueño del código y el diseño desde el primer día.');
  } else if (features.needsCheckout || features.needsCatalog) {
    plan = 'BUSINESS';
    if (features.needsCheckout) {
      reasons.push('Necesitas que tus clientes puedan comprar o pagar en línea.');
    }
    if (features.needsCatalog) {
      reasons.push('Necesitas mostrar un catálogo de productos o menú actualizable.');
    }
  } else if (features.needsBooking) {
    plan = 'PRO';
    reasons.push('Necesitas que tus clientes puedan agendar citas o turnos en línea.');
  } else {
    plan = 'BASIC';
    reasons.push('Tu sitio no requiere funcionalidades complejas — el plan BASIC es ideal.');
  }

  // ─── Sugerir add-ons (independientes del plan) ────────
  // los add-ons se mapean a códigos de catálogo.
  // Para proyectos nuevos estas sugerencias NO se escriben en projects.suggestedAddOns.
  // Son solo para mostrar al cliente en el paso de propuesta del wizard.
  if (features.needsBlog) {
    suggestedAddOns.push(ADD_ONS.C02_blog_engine);
  }
  if (features.needsCrmIntegration) {
    suggestedAddOns.push(ADD_ONS.I01_crm_sync);
  }
  if (features.needsMultiEmployeeCalendar) {
    suggestedAddOns.push(ADD_ONS.I02_advanced_booking);
  }
  if (materialStatus === 'no_tiene_nada') {
    suggestedAddOns.push(ADD_ONS.C01_copywriting);
  }

  // ─── Determinar si requiere revisión manual ───────────
  const requiresReview = plan === 'LEGACY';

  return { plan, reasons, requiresReview, suggestedAddOns };
}

/**
 * Maps a feature-based suggestion key to its catalog item code.
 * Used by intake catalog suggestions to avoid re-importing ADD_ONS.
 */
export function suggestedAddOnToCatalogCode(key: string): string | null {
  return ADD_ONS[key]?.catalogCode ?? null;
}

/**
 * Retorna el precio mensual en centavos USD para el plan detectado.
 */
export function getPlanPriceCents(plan: PlanDetectionResult['plan']): number {
  const prices: Record<PlanDetectionResult['plan'], number> = {
    BASIC: 4900,    // $49/mes
    PRO: 8900,      // $89/mes
    BUSINESS: 13900, // $139/mes
    LEGACY: 0,      // Precio personalizado (requiresReview)
  };
  return prices[plan];
}

/**
 * Retorna la etiqueta legible del plan para la UI.
 */
export function getPlanLabel(plan: PlanDetectionResult['plan']): string {
  const labels: Record<PlanDetectionResult['plan'], string> = {
    BASIC: 'Plan BASIC — $49/mes',
    PRO: 'Plan PRO — $89/mes',
    BUSINESS: 'Plan BUSINESS — $139/mes',
    LEGACY: 'Propuesta personalizada',
  };
  return labels[plan];
}
