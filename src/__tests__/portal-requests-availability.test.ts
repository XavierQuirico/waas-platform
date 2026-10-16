// Portal — Solicitudes: disponibilidad por plan y estado
// Valida el flujo de solicitudes del portal cliente contra el motor/catálogo ya validado.
// No requiere DB ni auth — prueba motor puro + seed JSON.

import { describe, expect, it } from 'vitest';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import { isReactivationCapabilityVisible } from '@/lib/catalog/types';
import {
  ADMIN_ONLY_PORTAL_BLOCKED_CODES,
  LEGACY_MAINTENANCE_CODES,
  CORE_BASE_CODES,
  isCatalogPortalVisibilityEditable,
} from '@/lib/catalog/catalog-safety';
import catalogDefaults from '@/db/seeds/catalog-defaults.json';
import type {
  CatalogCapability,
  CatalogPlanRule,
  CatalogRequestInput,
  ProjectCatalogContext,
} from '@/lib/catalog/types';

const caps = catalogDefaults.capabilities as Array<Record<string, unknown>>;
const cats = catalogDefaults.portalCategories as Array<Record<string, unknown>>;

const now = new Date('2026-05-30T12:00:00Z');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCap(overrides: Partial<CatalogCapability> = {}): CatalogCapability {
  return {
    id: 'cap-test',
    code: 'T01',
    active: true,
    pricingMode: 'fixed',
    listPriceCents: 9900,
    priceCents: 9900,
    dependencies: [],
    conflicts: [],
    ...overrides,
  };
}

function makePlanRule(availability: 'included' | 'paid' | 'quote' | 'unavailable', overrides: Partial<CatalogPlanRule> = {}): CatalogPlanRule {
  return {
    availability,
    inclusionScope: availability === 'included' ? 'initial_setup' : null,
    initialIncludedQty: availability === 'included' ? 1 : 0,
    recurringIncludedQty: 0,
    recurringPeriod: null,
    overageMode: 'unavailable',
    overageAddonCode: null,
    allowedRequestKinds: ['change', 'expansion', 'maintenance', 'correction', 'reactivation', 'initial_delivery'],
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectCatalogContext> = {}): ProjectCatalogContext {
  return {
    id: 'proj-test',
    plan: 'PRO',
    status: 'LIVE',
    postLaunchWarrantyEndsAt: null,
    suspendedAt: null,
    reactivationFeeActive: false,
    ...overrides,
  };
}

function makeInput(overrides: Partial<CatalogRequestInput> = {}): CatalogRequestInput {
  return {
    capability: makeCap(),
    planRule: makePlanRule('paid'),
    project: makeProject(),
    requestKind: 'change',
    quantity: 1,
    now,
    usageHistory: [],
    deliveredCapabilityCodes: [],
    availableCapabilityCodes: [],
    ...overrides,
  };
}

function getSeedCap(code: string) {
  return caps.find((c) => c.code === code) as Record<string, unknown> | undefined;
}

function getSeedCapRule(code: string, plan: string) {
  const cap = getSeedCap(code);
  if (!cap) return undefined;
  const rules = cap.planRules as Record<string, { availability: string }> | undefined;
  return rules?.[plan];
}

// ─── A. Fuente de datos — seed como proxy ─────────────────────────────────────

describe('fuente de datos — seed refleja catálogo esperado', () => {
  it('catálogo tiene 47 capacidades activas', () => {
    expect(caps).toHaveLength(47);
    expect(caps.filter((c) => c.active === false)).toHaveLength(0);
  });

  it('27 capacidades son visibleInPortal=true', () => {
    expect(caps.filter((c) => c.visibleInPortal === true)).toHaveLength(27);
  });

  it('0 capacidades obsoletas en catálogo', () => {
    const obsolete = ['D04','XI02','XI05','XI06','XI07','XI08','XI09','CM01','EM03','EM04','CE03','EC02','EC06','EC08'];
    const codes = new Set(caps.map((c) => c.code as string));
    for (const code of obsolete) {
      expect(codes.has(code), `código obsoleto ${code} no debe existir`).toBe(false);
    }
  });
});

// ─── B. Admin-only/internal no expuestos en portal ────────────────────────────

describe('códigos admin-only/internal no visibles en portal', () => {
  it('EM01 visibleInPortal=false', () => {
    expect(getSeedCap('EM01')?.visibleInPortal).toBe(false);
  });

  it('EM02 visibleInPortal=false', () => {
    expect(getSeedCap('EM02')?.visibleInPortal).toBe(false);
  });

  it('EC01 visibleInPortal=false', () => {
    expect(getSeedCap('EC01')?.visibleInPortal).toBe(false);
  });

  it('EC03 visibleInPortal=false', () => {
    expect(getSeedCap('EC03')?.visibleInPortal).toBe(false);
  });

  it('EC04 visibleInPortal=false', () => {
    expect(getSeedCap('EC04')?.visibleInPortal).toBe(false);
  });

  it('EC05 visibleInPortal=false', () => {
    expect(getSeedCap('EC05')?.visibleInPortal).toBe(false);
  });

  it('EC07 visibleInPortal=false', () => {
    expect(getSeedCap('EC07')?.visibleInPortal).toBe(false);
  });

  it('LM01 visibleInPortal=false', () => {
    expect(getSeedCap('LM01')?.visibleInPortal).toBe(false);
  });

  it('LM02 visibleInPortal=false', () => {
    expect(getSeedCap('LM02')?.visibleInPortal).toBe(false);
  });

  it('LM03 visibleInPortal=false', () => {
    expect(getSeedCap('LM03')?.visibleInPortal).toBe(false);
  });

  it('LM04 visibleInPortal=false', () => {
    expect(getSeedCap('LM04')?.visibleInPortal).toBe(false);
  });

  it('LM05 visibleInPortal=false', () => {
    expect(getSeedCap('LM05')?.visibleInPortal).toBe(false);
  });

  it('ADMIN_ONLY_PORTAL_BLOCKED_CODES contiene EM01/EM02/EC01/EC03/EC04/EC05/EC07', () => {
    for (const code of ['EM01','EM02','EC01','EC03','EC04','EC05','EC07']) {
      expect(ADMIN_ONLY_PORTAL_BLOCKED_CODES.has(code)).toBe(true);
    }
  });

  it('LEGACY_MAINTENANCE_CODES contiene LM01-LM05', () => {
    for (const code of ['LM01','LM02','LM03','LM04','LM05']) {
      expect(LEGACY_MAINTENANCE_CODES.has(code)).toBe(true);
    }
  });

  it('CORE_BASE_CODES contiene B01-B07 y WA01', () => {
    for (const code of ['B01','B02','B03','B04','B05','B06','B07','WA01']) {
      expect(CORE_BASE_CODES.has(code)).toBe(true);
    }
  });
});

// ─── C. Categorías del portal ─────────────────────────────────────────────────

describe('categorías del portal', () => {
  it('cat_ecommerce está inactiva (no debe aparecer en portal)', () => {
    const cat = cats.find((c) => c.id === 'cat_ecommerce');
    expect(cat).toBeDefined();
    expect(cat!.active).toBe(false);
  });

  it('cat_catalog tiene visibilityRule=project_has_catalog', () => {
    const cat = cats.find((c) => c.id === 'cat_catalog');
    expect(cat).toBeDefined();
    expect(cat!.visibilityRule).toBe('project_has_catalog');
  });

  it('cat_reactivation tiene visibilityRule=project_suspended', () => {
    const cat = cats.find((c) => c.id === 'cat_reactivation');
    expect(cat).toBeDefined();
    expect(cat!.visibilityRule).toBe('project_suspended');
  });

  it('motor: proyecto LIVE no puede solicitar R01 (blocked: r01_requires_suspended_project)', () => {
    const r01Cap = makeCap({ code: 'R01', pricingMode: 'fixed', priceCents: 2500 });
    const decision = resolveCatalogRequest(
      makeInput({ capability: r01Cap, project: makeProject({ plan: 'PRO', status: 'LIVE' }) }),
    );
    expect(decision.nextAction).toBe('blocked');
    expect(decision.reasonCode).toBe('r01_requires_suspended_project');
  });

  it('motor: proyecto SUSPENDED puede ver R01 cuando reactivationFeeActive=true', () => {
    const r01Cap = makeCap({ code: 'R01', pricingMode: 'fixed', priceCents: 2500 });
    const decision = resolveCatalogRequest(
      makeInput({
        capability: r01Cap,
        planRule: makePlanRule('paid', { allowedRequestKinds: ['reactivation'] }),
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          reactivationFeeActive: true,
        }),
        requestKind: 'reactivation',
      }),
    );
    expect(decision.nextAction).not.toBe('blocked');
    expect(decision.decision).toBe('paid_addon');
  });

  it('motor: proyecto SUSPENDED sin flag — R01 bloqueado antes de día 11 suspendedAt', () => {
    const r01Cap = makeCap({ code: 'R01', pricingMode: 'fixed', priceCents: 2500 });
    const suspendedAt = new Date(now.getTime() - 5 * 86_400_000); // 5 días suspendido
    const decision = resolveCatalogRequest(
      makeInput({
        capability: r01Cap,
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          suspendedAt,
          reactivationFeeActive: false,
        }),
      }),
    );
    expect(decision.nextAction).toBe('blocked');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });

  it('motor: proyecto SUSPENDED — R01 activo a partir de día 11 suspendedAt', () => {
    const r01Cap = makeCap({ code: 'R01', pricingMode: 'fixed', priceCents: 2500 });
    const suspendedAt = new Date(now.getTime() - 12 * 86_400_000); // 12 días suspendido
    const decision = resolveCatalogRequest(
      makeInput({
        capability: r01Cap,
        planRule: makePlanRule('paid', { allowedRequestKinds: ['reactivation'] }),
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          suspendedAt,
          reactivationFeeActive: false,
        }),
        requestKind: 'reactivation',
      }),
    );
    expect(decision.nextAction).not.toBe('blocked');
  });

  it('isReactivationCapabilityVisible: false antes de día 11', () => {
    const suspendedAt = new Date(now.getTime() - 5 * 86_400_000);
    expect(isReactivationCapabilityVisible({ status: 'SUSPENDED', suspendedAt, reactivationFeeActive: false }, now)).toBe(false);
  });

  it('isReactivationCapabilityVisible: true desde día 11', () => {
    const suspendedAt = new Date(now.getTime() - 11 * 86_400_000);
    expect(isReactivationCapabilityVisible({ status: 'SUSPENDED', suspendedAt, reactivationFeeActive: false }, now)).toBe(true);
  });

  it('isReactivationCapabilityVisible: true cuando reactivationFeeActive=true (sin importar días)', () => {
    const suspendedAt = new Date(now.getTime() - 2 * 86_400_000);
    expect(isReactivationCapabilityVisible({ status: 'SUSPENDED', suspendedAt, reactivationFeeActive: true }, now)).toBe(true);
  });

  it('isReactivationCapabilityVisible: false en proyecto LIVE', () => {
    expect(isReactivationCapabilityVisible({ status: 'LIVE', suspendedAt: null, reactivationFeeActive: false }, now)).toBe(false);
  });
});

// ─── D. Plan BASIC ────────────────────────────────────────────────────────────

describe('plan BASIC — disponibilidad por capacidad', () => {
  it('C04 BASIC=paid', () => {
    expect(getSeedCapRule('C04', 'BASIC')?.availability).toBe('paid');
  });

  it('CM02 BASIC=paid', () => {
    expect(getSeedCapRule('CM02', 'BASIC')?.availability).toBe('paid');
  });

  it('WA03 BASIC=paid', () => {
    expect(getSeedCapRule('WA03', 'BASIC')?.availability).toBe('paid');
  });

  it('XI01 BASIC=paid', () => {
    expect(getSeedCapRule('XI01', 'BASIC')?.availability).toBe('paid');
  });

  it('I02 BASIC=unavailable', () => {
    expect(getSeedCapRule('I02', 'BASIC')?.availability).toBe('unavailable');
  });

  it('I04 BASIC=unavailable', () => {
    expect(getSeedCapRule('I04', 'BASIC')?.availability).toBe('unavailable');
  });

  it('motor: BASIC + unavailable rule → decision unavailable, nextAction request_admin_review', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'BASIC' }),
        planRule: makePlanRule('unavailable'),
      }),
    );
    expect(decision.decision).toBe('unavailable');
    expect(decision.nextAction).toBe('request_admin_review');
  });

  it('motor: BASIC + paid rule → decision paid_addon con precio de DB', () => {
    const priceCents = 7900;
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'BASIC' }),
        capability: makeCap({ priceCents }),
        planRule: makePlanRule('paid'),
      }),
    );
    expect(decision.decision).toBe('paid_addon');
    expect(decision.totalPriceCents).toBe(priceCents);
  });
});

// ─── E. Plan PRO ──────────────────────────────────────────────────────────────

describe('plan PRO — disponibilidad por capacidad', () => {
  it('CM02 PRO=included', () => {
    expect(getSeedCapRule('CM02', 'PRO')?.availability).toBe('included');
  });

  it('WA03 PRO=included', () => {
    expect(getSeedCapRule('WA03', 'PRO')?.availability).toBe('included');
  });

  it('XI01 PRO=included', () => {
    expect(getSeedCapRule('XI01', 'PRO')?.availability).toBe('included');
  });

  it('I02 PRO=paid', () => {
    expect(getSeedCapRule('I02', 'PRO')?.availability).toBe('paid');
  });

  it('I04 PRO=unavailable', () => {
    expect(getSeedCapRule('I04', 'PRO')?.availability).toBe('unavailable');
  });

  it('motor: PRO + included_setup rule → decision included_setup, totalPriceCents=0', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'PRO' }),
        planRule: makePlanRule('included', { inclusionScope: 'initial_setup', initialIncludedQty: 1 }),
        capability: makeCap({ pricingMode: 'included', priceCents: 0 }),
        requestKind: 'initial_delivery',
      }),
    );
    expect(decision.decision).toBe('included_setup');
    expect(decision.totalPriceCents).toBe(0);
  });

  it('motor: PRO + paid rule → decision paid_addon con precio de DB (no cliente)', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'PRO' }),
        capability: makeCap({ priceCents: 12900 }),
        planRule: makePlanRule('paid'),
      }),
    );
    expect(decision.decision).toBe('paid_addon');
    expect(decision.totalPriceCents).toBe(12900);
  });
});

// ─── F. Plan BUSINESS ────────────────────────────────────────────────────────

describe('plan BUSINESS — disponibilidad por capacidad', () => {
  it('CM02 BUSINESS=included', () => {
    expect(getSeedCapRule('CM02', 'BUSINESS')?.availability).toBe('included');
  });

  it('WA03 BUSINESS=included', () => {
    expect(getSeedCapRule('WA03', 'BUSINESS')?.availability).toBe('included');
  });

  it('XI01 BUSINESS=included', () => {
    expect(getSeedCapRule('XI01', 'BUSINESS')?.availability).toBe('included');
  });

  it('I02 BUSINESS=paid', () => {
    expect(getSeedCapRule('I02', 'BUSINESS')?.availability).toBe('paid');
  });

  it('I04 BUSINESS=paid (proyecto con catálogo)', () => {
    expect(getSeedCapRule('I04', 'BUSINESS')?.availability).toBe('paid');
  });

  it('WA02 BUSINESS=included (catálogo pedido por WhatsApp)', () => {
    expect(getSeedCapRule('WA02', 'BUSINESS')?.availability).toBe('included');
  });

  it('WA02 BASIC=unavailable', () => {
    expect(getSeedCapRule('WA02', 'BASIC')?.availability).toBe('unavailable');
  });

  it('WA02 PRO=unavailable', () => {
    expect(getSeedCapRule('WA02', 'PRO')?.availability).toBe('unavailable');
  });

  it('motor: BUSINESS + I04 paid → decision paid_addon, totalPriceCents=9900', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'BUSINESS' }),
        capability: makeCap({ code: 'I04', priceCents: 9900, pricingMode: 'fixed' }),
        planRule: makePlanRule('paid'),
      }),
    );
    expect(decision.decision).toBe('paid_addon');
    expect(decision.totalPriceCents).toBe(9900);
  });
});

// ─── G. Plan LEGACY ──────────────────────────────────────────────────────────

describe('plan LEGACY — comportamiento', () => {
  it('WA02 LEGACY=quote', () => {
    expect(getSeedCapRule('WA02', 'LEGACY')?.availability).toBe('quote');
  });

  it('WA03 LEGACY=quote', () => {
    expect(getSeedCapRule('WA03', 'LEGACY')?.availability).toBe('quote');
  });

  it('I04 LEGACY=quote', () => {
    expect(getSeedCapRule('I04', 'LEGACY')?.availability).toBe('quote');
  });

  it('motor: LEGACY + quote rule → decision quote_required, sin precio fijo', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'LEGACY' }),
        capability: makeCap({ pricingMode: 'fixed', priceCents: 7900 }),
        planRule: makePlanRule('quote'),
      }),
    );
    expect(decision.decision).toBe('quote_required');
    expect(decision.totalPriceCents).toBeNull();
  });

  it('motor: LEGACY + quote → nextAction=request_quote (no dispara pago automático)', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'LEGACY' }),
        planRule: makePlanRule('quote'),
      }),
    );
    expect(decision.nextAction).toBe('request_quote');
  });
});

// ─── H. SUSPENDED — bloqueo y R01 ────────────────────────────────────────────

describe('proyecto SUSPENDED — bloqueos y R01', () => {
  it('motor: SUSPENDED + capacidad non-R01 → blocked (suspended_commercial_blocked)', () => {
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'PRO', status: 'SUSPENDED' }),
      }),
    );
    expect(decision.nextAction).toBe('blocked');
    expect(decision.reasonCode).toBe('suspended_commercial_blocked');
  });

  it('motor: SUSPENDED + R01 antes de día 11 → blocked (r01_not_yet_active)', () => {
    const suspendedAt = new Date(now.getTime() - 5 * 86_400_000);
    const decision = resolveCatalogRequest(
      makeInput({
        capability: makeCap({ code: 'R01', priceCents: 2500 }),
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          suspendedAt,
          reactivationFeeActive: false,
        }),
      }),
    );
    expect(decision.nextAction).toBe('blocked');
    expect(decision.reasonCode).toBe('r01_not_yet_active');
  });

  it('motor: SUSPENDED + R01 día 11+ → paid_addon (reactivación permitida)', () => {
    const suspendedAt = new Date(now.getTime() - 11 * 86_400_000);
    const decision = resolveCatalogRequest(
      makeInput({
        capability: makeCap({ code: 'R01', priceCents: 2500, pricingMode: 'fixed' }),
        planRule: makePlanRule('paid', { allowedRequestKinds: ['reactivation'] }),
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          suspendedAt,
          reactivationFeeActive: false,
        }),
        requestKind: 'reactivation',
      }),
    );
    expect(decision.decision).toBe('paid_addon');
    expect(decision.nextAction).not.toBe('blocked');
  });

  it('motor: SUSPENDED + R01 con reactivationFeeActive=true → paid_addon inmediatamente', () => {
    const suspendedAt = new Date(now.getTime() - 2 * 86_400_000);
    const decision = resolveCatalogRequest(
      makeInput({
        capability: makeCap({ code: 'R01', priceCents: 2500, pricingMode: 'fixed' }),
        planRule: makePlanRule('paid', { allowedRequestKinds: ['reactivation'] }),
        project: makeProject({
          plan: 'PRO',
          status: 'SUSPENDED',
          suspendedAt,
          reactivationFeeActive: true,
        }),
        requestKind: 'reactivation',
      }),
    );
    expect(decision.decision).toBe('paid_addon');
    expect(decision.nextAction).not.toBe('blocked');
  });
});

// ─── I. Estados bloqueantes ───────────────────────────────────────────────────

describe('estados de proyecto que bloquean solicitudes comerciales', () => {
  const blockedStatuses = [
    'CLOSED', 'CANCELLED', 'PROPOSAL_EXPIRED',
    'AWAITING_ASSETS', 'ASSETS_INCOMPLETE', 'ASSETS_SUBMITTED',
    'ASSETS_UNDER_REVIEW', 'PRODUCTION_STARTED',
  ] as const;

  for (const status of blockedStatuses) {
    it(`motor: proyecto en ${status} bloquea solicitudes comerciales`, () => {
      const decision = resolveCatalogRequest(
        makeInput({
          project: makeProject({ plan: 'PRO', status: status as any }),
        }),
      );
      expect(decision.nextAction).toBe('blocked');
    });
  }

  it('motor: proyecto LIVE permite solicitudes', () => {
    expect(resolveCatalogRequest(makeInput()).nextAction).not.toBe('blocked');
  });

  it('motor: proyecto STAGING_REVIEW permite solicitudes comerciales', () => {
    const decision = resolveCatalogRequest(
      makeInput({ project: makeProject({ status: 'STAGING_REVIEW' }) }),
    );
    expect(decision.nextAction).not.toBe('blocked');
  });

  it('motor: proyecto REVISIONS permite solicitudes comerciales', () => {
    const decision = resolveCatalogRequest(
      makeInput({ project: makeProject({ status: 'REVISIONS' }) }),
    );
    expect(decision.nextAction).not.toBe('blocked');
  });
});

// ─── J. Submit server-side — rechazo de unavailable ──────────────────────────

describe('motor rechaza correctamente unavailable y blocked', () => {
  it('motor: unavailable tiene nextAction=request_admin_review (no blocked)', () => {
    const decision = resolveCatalogRequest(
      makeInput({ planRule: makePlanRule('unavailable') }),
    );
    expect(decision.decision).toBe('unavailable');
    expect(decision.nextAction).toBe('request_admin_review');
  });

  it('motor: unavailable no debe pasar al submit — la action debe rechazarlo', () => {
    // El server action ahora lanza si decision.decision === 'unavailable'.
    // Este test valida la lógica del motor para confirmar qué sería la decisión
    // cuando un cliente intenta enviar un item unavailable.
    const decision = resolveCatalogRequest(
      makeInput({
        project: makeProject({ plan: 'BASIC' }),
        planRule: makePlanRule('unavailable'),
      }),
    );
    expect(decision.decision).toBe('unavailable');
    // La action de submit comprueba decision.decision === 'unavailable' y lanza.
    // (verificado por inspección de actions.ts)
  });

  it('motor: capability inactive → blocked (capability_disabled)', () => {
    const decision = resolveCatalogRequest(
      makeInput({ capability: makeCap({ active: false }) }),
    );
    expect(decision.decision).toBe('blocked_disabled');
    expect(decision.nextAction).toBe('blocked');
  });

  it('motor: precio viene de DB (priceCents del capability), no del cliente', () => {
    const dbPrice = 14900;
    const decision = resolveCatalogRequest(
      makeInput({
        capability: makeCap({ priceCents: dbPrice }),
        planRule: makePlanRule('paid'),
      }),
    );
    expect(decision.totalPriceCents).toBe(dbPrice);
    expect(decision.unitPriceCents).toBe(dbPrice);
  });

  it('motor: snapshot incluye plan, estado, decision y precio en el momento', () => {
    const decision = resolveCatalogRequest(makeInput());
    expect(decision.snapshot).toBeDefined();
    expect(decision.snapshot.plan).toBe('PRO');
    expect(decision.snapshot.projectStatus).toBe('LIVE');
    expect(decision.snapshot.decision).toBe('paid_addon');
    expect(typeof decision.snapshot.generatedAt).toBe('string');
  });
});

// ─── K. Visibilidad portal — safety codes ────────────────────────────────────

describe('safety guards — admin-only no puede tornarse portal-visible', () => {
  it('EM01/EM02 no pueden hacerse portal-visible (admin-only)', () => {
    expect(isCatalogPortalVisibilityEditable('EM01')).toBe(false);
    expect(isCatalogPortalVisibilityEditable('EM02')).toBe(false);
  });

  it('EC01/EC03/EC04/EC05/EC07 no pueden hacerse portal-visible (quote-engine/admin-only)', () => {
    for (const code of ['EC01','EC03','EC04','EC05','EC07']) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });

  it('LM01-LM05 no pueden hacerse portal-visible (legacy-maintenance)', () => {
    for (const code of ['LM01','LM02','LM03','LM04','LM05']) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });

  it('B01-B07, WA01 no pueden hacerse portal-visible (core-base)', () => {
    for (const code of ['B01','B02','B03','B04','B05','B06','B07','WA01']) {
      expect(isCatalogPortalVisibilityEditable(code)).toBe(false);
    }
  });
});

// ─── L. R01 en seed ──────────────────────────────────────────────────────────

describe('R01 reactivación en seed', () => {
  const r01 = caps.find((c) => c.code === 'R01') as Record<string, unknown> | undefined;

  it('R01 existe en el catálogo', () => { expect(r01).toBeDefined(); });
  it('R01 priceCents=2500 ($25)', () => { expect(r01!.priceCents).toBe(2500); });
  it('R01 visibleInPortal=true (condicional por motor)', () => { expect(r01!.visibleInPortal).toBe(true); });
  it('R01 pricingMode=fixed', () => { expect(r01!.pricingMode).toBe('fixed'); });
  it('R01 publicDescription no contiene precio hardcodeado', () => {
    expect(String(r01!.publicDescription)).not.toContain('$25');
    expect(String(r01!.publicDescription)).not.toContain('25 USD');
  });
});

// ─── M. No categorías vacías ──────────────────────────────────────────────────

describe('no deben existir categorías vacías en seed activas no-catalog', () => {
  it('todas las categorías activas (except cat_catalog) tienen capacidades visibleInPortal=true', () => {
    const activeCats = cats.filter((c) => c.active !== false && c.id !== 'cat_catalog');
    for (const cat of activeCats) {
      const items = caps.filter(
        (cap) => cap.portalCategory === cat.id && cap.visibleInPortal === true,
      );
      expect(
        items.length,
        `categoría ${cat.id} tiene ${items.length} items visibles — no debe quedar vacía`,
      ).toBeGreaterThan(0);
    }
  });

  it('cat_catalog tiene capacidades visibleInPortal=true (para planes que las ven)', () => {
    const items = caps.filter(
      (cap) => cap.portalCategory === 'cat_catalog' && cap.visibleInPortal === true,
    );
    expect(items.length).toBeGreaterThan(0);
  });
});
