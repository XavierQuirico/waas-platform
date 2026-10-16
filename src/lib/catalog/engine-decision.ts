import type { CatalogDecisionCode, CatalogPlanRule, SubscriptionPlan } from './types';

export type EngineDecision =
  | 'included'
  | 'included_uses_allowance'
  | 'paid_addon'
  | 'upgrade_required'
  | 'quote_required'
  | 'legacy_module'
  | 'maintenance_included'
  | 'maintenance_quote_required'
  | 'deprecated'
  | 'unavailable';

export type LegacyTier =
  | 'STARTER'
  | 'BUSINESS_CUSTOM'
  | 'CATALOG'
  | 'COMMERCE'
  | 'PORTAL_APP';

export interface EngineDecisionContext {
  plan: SubscriptionPlan;
  decisionCode: CatalogDecisionCode;
  reasonCode: string;
  planRule: CatalogPlanRule | null;
  isMaintenance?: boolean;
  capabilityCode?: string;
  portalCategory?: string | null;
  capabilityTags?: string[];
}

export interface EngineDecisionResult {
  engineDecision: EngineDecision;
  recommendedUpgradePlan?: SubscriptionPlan;
  recommendedLegacyTier?: LegacyTier;
  clientMessage: string;
  adminMessage?: string;
}

const LEGACY_MODULE_REASON_CODES = new Set([
  'quote_pricing',
  'missing_plan_rule',
]);

// Capabilities that jump directly to BUSINESS (skip PRO)
const CATALOG_CAPABILITY_CODES = new Set([
  'WA02', 'E01', 'E02', 'E03', 'E04', 'E05',
]);

// Portal categories that map to specific upgrade targets
const ECOMMERCE_CATEGORIES = new Set(['cat_ecommerce']);
const CATALOG_CATEGORIES   = new Set(['cat_catalog']);

// Capability codes that require LEGACY (e-commerce, active modules only: EC01, EC03, EC04, EC07)
const LEGACY_REQUIRED_CODES = new Set([
  'EC01','EC03','EC04','EC07',
]);

// EC05 = portal/login de clientes → PORTAL_APP tier (separate from COMMERCE)
const PORTAL_APP_CODES = new Set([
  'EC05',
]);

// Capability codes that target PRO (booking, blog)
const PRO_TARGET_CODES = new Set([
  'I01','I02','C02A','C02B',
]);

export function resolveEngineDecision(ctx: EngineDecisionContext): EngineDecisionResult {
  const { plan, decisionCode, reasonCode, planRule, isMaintenance, capabilityCode, portalCategory } = ctx;

  if (decisionCode === 'blocked_disabled') {
    return {
      engineDecision: 'deprecated',
      clientMessage: 'Esta capacidad ya no está disponible. Consulta las opciones actualizadas.',
    };
  }

  if (decisionCode === 'included_setup' || decisionCode === 'included_warranty') {
    if (isMaintenance) {
      return {
        engineDecision: 'maintenance_included',
        clientMessage: 'Incluido en tu plan de mantenimiento.',
      };
    }
    return {
      engineDecision: 'included',
      clientMessage: 'Incluido en el setup de tu plan.',
    };
  }

  if (decisionCode === 'included_allowance') {
    if (isMaintenance) {
      return {
        engineDecision: 'maintenance_included',
        clientMessage: 'Incluido en tu cupo mensual de mantenimiento.',
      };
    }
    return {
      engineDecision: 'included_uses_allowance',
      clientMessage: 'Usa tu cupo mensual incluido en el plan.',
    };
  }

  if (decisionCode === 'paid_addon') {
    return {
      engineDecision: 'paid_addon',
      clientMessage: 'Disponible como servicio adicional con costo.',
    };
  }

  if (decisionCode === 'quote_required') {
    if (isMaintenance) {
      return {
        engineDecision: 'maintenance_quote_required',
        clientMessage: 'Esta solicitud requiere cotización separada.',
      };
    }
    if (plan === 'LEGACY' && LEGACY_MODULE_REASON_CODES.has(reasonCode)) {
      return {
        engineDecision: 'legacy_module',
        recommendedLegacyTier: inferLegacyTier(capabilityCode, portalCategory),
        clientMessage: 'Este módulo se cotiza como parte de tu proyecto LEGACY.',
        adminMessage: 'Cotizar como módulo adicional al proyecto LEGACY.',
      };
    }
    // Non-LEGACY plan requesting EC active codes (EC01, EC03, EC04, EC05, EC07) via quote → escalate to LEGACY
    if (
      plan !== 'LEGACY' &&
      capabilityCode &&
      (LEGACY_REQUIRED_CODES.has(capabilityCode) || PORTAL_APP_CODES.has(capabilityCode))
    ) {
      const legacyTier = inferLegacyTier(capabilityCode, portalCategory);
      return {
        engineDecision: 'quote_required',
        recommendedUpgradePlan: 'LEGACY',
        recommendedLegacyTier: legacyTier,
        clientMessage: 'Esto requiere revisión como proyecto a medida.',
        adminMessage: `Evaluar como LEGACY ${legacyTier === 'PORTAL_APP' ? 'Portal App' : 'Commerce'}.`,
      };
    }
    return {
      engineDecision: 'quote_required',
      clientMessage: 'Esta capacidad requiere cotización personalizada.',
    };
  }

  if (decisionCode === 'unavailable') {
    const isUpgradeScenario =
      reasonCode === 'rule_unavailable' &&
      planRule !== null &&
      planRule.availability === 'unavailable';

    if (isUpgradeScenario && plan !== 'LEGACY') {
      const recommended = inferUpgradePlan(plan, capabilityCode, portalCategory);
      return {
        engineDecision: 'upgrade_required',
        recommendedUpgradePlan: recommended,
        clientMessage: `Disponible en el plan ${recommended}. Consulta cómo mejorar tu plan.`,
        adminMessage: `Cliente en ${plan}. Capacidad requiere upgrade a ${recommended}.`,
      };
    }
    return {
      engineDecision: 'unavailable',
      clientMessage: 'Esta capacidad no está disponible en tu plan actual.',
    };
  }

  return {
    engineDecision: 'unavailable',
    clientMessage: 'Estado no determinado. Contacta soporte.',
  };
}

function inferUpgradePlan(
  currentPlan: SubscriptionPlan,
  capabilityCode?: string,
  portalCategory?: string | null,
): SubscriptionPlan {
  // Portal/login capabilities → always LEGACY
  if (capabilityCode && PORTAL_APP_CODES.has(capabilityCode)) {
    return 'LEGACY';
  }
  // E-commerce capabilities → always LEGACY
  if (
    (capabilityCode && LEGACY_REQUIRED_CODES.has(capabilityCode)) ||
    (portalCategory && ECOMMERCE_CATEGORIES.has(portalCategory))
  ) {
    return 'LEGACY';
  }

  // Catalog capabilities: BASIC→BUSINESS, others use ladder
  if (
    (capabilityCode && (CATALOG_CAPABILITY_CODES.has(capabilityCode) || capabilityCode.startsWith('E0'))) ||
    (portalCategory && CATALOG_CATEGORIES.has(portalCategory))
  ) {
    if (currentPlan === 'BASIC') return 'BUSINESS';
    if (currentPlan === 'PRO')   return 'BUSINESS';
    return 'LEGACY';
  }

  // Booking/chatbot/blog capabilities → PRO (if BASIC), then BUSINESS ladder
  if (capabilityCode && PRO_TARGET_CODES.has(capabilityCode)) {
    if (currentPlan === 'BASIC') return 'PRO';
    if (currentPlan === 'PRO')   return 'BUSINESS';
    return 'LEGACY';
  }

  // Generic ladder
  const upgradePath: Record<SubscriptionPlan, SubscriptionPlan> = {
    BASIC: 'PRO',
    PRO: 'BUSINESS',
    BUSINESS: 'LEGACY',
    LEGACY: 'LEGACY',
  };
  return upgradePath[currentPlan];
}

function inferLegacyTier(
  capabilityCode?: string,
  portalCategory?: string | null,
): LegacyTier {
  // EC05 = portal/login de clientes → PORTAL_APP
  if (capabilityCode && PORTAL_APP_CODES.has(capabilityCode)) {
    return 'PORTAL_APP';
  }
  // E-commerce tier
  if (
    (capabilityCode && LEGACY_REQUIRED_CODES.has(capabilityCode)) ||
    (portalCategory && ECOMMERCE_CATEGORIES.has(portalCategory))
  ) {
    return 'COMMERCE';
  }
  // Catalog tier
  if (
    (capabilityCode && (CATALOG_CAPABILITY_CODES.has(capabilityCode) || capabilityCode.startsWith('WA') || capabilityCode.startsWith('E0'))) ||
    (portalCategory && CATALOG_CATEGORIES.has(portalCategory))
  ) {
    return 'CATALOG';
  }
  return 'BUSINESS_CUSTOM';
}
