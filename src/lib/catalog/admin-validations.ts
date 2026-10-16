// Pure validation functions for admin catalog mutations.
// No DB, no auth — import and test independently.

export const VALID_REQUEST_KINDS = [
  'initial_delivery',
  'change',
  'correction',
  'expansion',
  'maintenance',
  'reactivation',
] as const;

export type ValidRequestKind = typeof VALID_REQUEST_KINDS[number];

type PlanRuleValidationInput = {
  availability: 'included' | 'paid' | 'quote' | 'unavailable';
  inclusionScope: 'initial_setup' | 'recurring_allowance' | null;
  initialIncludedQty: number;
  recurringIncludedQty: number;
  recurringPeriod: 'calendar_month' | null;
  allowedRequestKinds: string[];
};

export function validatePlanRule(input: PlanRuleValidationInput): string | null {
  if (input.allowedRequestKinds.length === 0) {
    return 'Selecciona al menos un tipo de solicitud.';
  }
  const validSet = new Set<string>(VALID_REQUEST_KINDS);
  for (const kind of input.allowedRequestKinds) {
    if (!validSet.has(kind)) {
      return `Tipo de solicitud inválido: "${kind}".`;
    }
  }
  if (input.availability === 'included') {
    if (!input.inclusionScope) {
      return 'Las reglas "incluido" requieren un alcance (setup inicial o cupo recurrente).';
    }
    if (input.inclusionScope === 'initial_setup' && input.initialIncludedQty <= 0) {
      return 'El cupo inicial debe ser mayor a 0 para setup.';
    }
    if (input.inclusionScope === 'recurring_allowance') {
      if (input.recurringIncludedQty <= 0) {
        return 'El cupo recurrente debe ser mayor a 0.';
      }
      if (!input.recurringPeriod) {
        return 'El cupo recurrente requiere un período (calendar_month).';
      }
    }
  }
  return null;
}

type CatalogItemUpdateValidationInput = {
  pricingMode?: 'included' | 'fixed' | 'quote';
  priceCents?: number;
  visibleInPortal?: boolean;
  dependencies?: string[] | null;
  conflicts?: (string | null)[] | null;
};

type CatalogItemContext = {
  code: string;
  effectivePortalCategoryId: string | null;
  portalCategoryActive: boolean | null;
  rules: PlanRuleValidationInput[];
};

export function validateCatalogItemUpdate(
  input: CatalogItemUpdateValidationInput,
  ctx: CatalogItemContext,
): string | null {
  if (input.pricingMode === 'fixed' && input.priceCents !== undefined && input.priceCents <= 0) {
    return 'El modo "fijo" requiere un precio mayor a $0.';
  }
  if (input.pricingMode === 'included') {
    const hasValidRule = ctx.rules.some((rule) => {
      if (rule.availability !== 'included') return false;
      if (rule.inclusionScope === 'initial_setup' && rule.initialIncludedQty > 0) return true;
      if (
        rule.inclusionScope === 'recurring_allowance' &&
        rule.recurringIncludedQty > 0 &&
        rule.recurringPeriod === 'calendar_month'
      ) return true;
      return false;
    });
    if (!hasValidRule) {
      return 'Un item incluido requiere al menos una regla de plan incluida con cupo válido.';
    }
  }
  if (input.visibleInPortal === true) {
    if (!ctx.effectivePortalCategoryId) {
      return 'Para ser visible en el portal, asigna una categoría de portal.';
    }
    if (ctx.portalCategoryActive === false) {
      return 'La categoría de portal asignada no está activa. Actívala primero.';
    }
  }
  if (input.dependencies?.includes(ctx.code)) {
    return `El ítem no puede depender de sí mismo (${ctx.code}).`;
  }
  if ((input.conflicts ?? []).some((c) => c === ctx.code)) {
    return `El ítem no puede tener conflicto consigo mismo (${ctx.code}).`;
  }
  return null;
}

export function validateCatalogDependencyGraph(input: {
  currentCode: string;
  nextDependencies: string[];
  knownItems: Array<{ code: string; dependencies: string[] | null }>;
}): string | null {
  if (input.nextDependencies.includes(input.currentCode)) {
    return `El ítem no puede depender de sí mismo (${input.currentCode}).`;
  }

  const knownCodes = new Set(input.knownItems.map((item) => item.code));
  for (const dep of input.nextDependencies) {
    if (!knownCodes.has(dep)) {
      return `Dependencia inexistente: ${dep}.`;
    }
  }

  const graph = new Map<string, string[]>();
  for (const item of input.knownItems) {
    if (item.code === input.currentCode) {
      graph.set(item.code, input.nextDependencies);
    } else {
      graph.set(item.code, item.dependencies ?? []);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function hasCycle(node: string): string | null {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = hasCycle(neighbor);
        if (cycle) return cycle;
      } else if (recursionStack.has(neighbor)) {
        path.push(neighbor);
        const startIndex = path.indexOf(neighbor);
        const cyclePath = path.slice(startIndex).join(' -> ');
        return `Dependencia circular detectada: ${cyclePath}.`;
      }
    }

    recursionStack.delete(node);
    path.pop();
    return null;
  }

  const cycle = hasCycle(input.currentCode);
  if (cycle) return cycle;

  return null;
}
