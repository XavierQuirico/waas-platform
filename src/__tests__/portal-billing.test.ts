// Portal — Facturación
// Cubre: lógica de estados de pago, tipos de proyecto, tickets cobrables,
// historial, multi-proyecto, scans de seguridad visual, alias /billing.
// No requiere DB ni auth — prueba lógica pura.

import { describe, expect, it } from 'vitest';
import {
  deriveBillingVisualState,
  isR01ChargeVisibleFromProject,
  getBillingStatusCopy,
  getBillingStatusDisplayCopy,
  formatMoneyCents,
  getBillingProjectLabel,
  getPaymentEventAmountCents,
  canShowPayPalManagement,
  canShowBillingStatusPayPalCta,
} from '@/lib/portal/billing-state';
import {
  deriveProjectType,
  deriveBillingPlan,
} from '@/lib/portal/project-type';
import { deriveClientTicketStatus } from '@/lib/tickets/billing';

// ─── Helpers de fecha ────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// ─── 1. SUBSCRIPTION muestra plan, mensualidad y PayPal externo ──────────────

describe('SUBSCRIPTION plan', () => {
  it('projectType es SUBSCRIPTION para plan BASIC', () => {
    expect(deriveProjectType('BASIC', false)).toBe('SUBSCRIPTION');
  });

  it('projectType es SUBSCRIPTION para plan PRO', () => {
    expect(deriveProjectType('PRO', false)).toBe('SUBSCRIPTION');
  });

  it('projectType es SUBSCRIPTION para plan BUSINESS', () => {
    expect(deriveProjectType('BUSINESS', false)).toBe('SUBSCRIPTION');
  });

  it('deriveBillingPlan retorna plan para SUBSCRIPTION', () => {
    expect(deriveBillingPlan('BASIC', 'SUBSCRIPTION')).toBe('BASIC');
    expect(deriveBillingPlan('PRO', 'SUBSCRIPTION')).toBe('PRO');
    expect(deriveBillingPlan('BUSINESS', 'SUBSCRIPTION')).toBe('BUSINESS');
  });

  it('estado activo cuando LIVE sin gracia ni suspensión', () => {
    const state = deriveBillingVisualState({
      status: 'LIVE',
      paymentGracePeriodUntil: null,
      suspendedAt: null,
      reactivationFeeActive: false,
    });
    expect(state).toBe('active');
  });

  it('formatMoneyCents formatea centavos correctamente', () => {
    expect(formatMoneyCents(4900)).toBe('$49 USD');
    expect(formatMoneyCents(8900)).toBe('$89 USD');
    expect(formatMoneyCents(13900)).toBe('$139 USD');
  });
});

// ─── 2. LEGACY no muestra suscripción SaaS ni PayPal SaaS ───────────────────

describe('LEGACY project', () => {
  it('projectType es LEGACY para plan LEGACY', () => {
    expect(deriveProjectType('LEGACY', false)).toBe('LEGACY');
  });

  it('deriveBillingPlan retorna null para LEGACY', () => {
    expect(deriveBillingPlan('LEGACY', 'LEGACY')).toBeNull();
  });

  it('estado activo para LEGACY CLOSED', () => {
    const state = deriveBillingVisualState({
      status: 'CLOSED',
      paymentGracePeriodUntil: null,
      suspendedAt: null,
      reactivationFeeActive: false,
    });
    expect(state).toBe('closed');
  });
});

// ─── 3. PORTFOLIO no muestra mensualidad ni PayPal ──────────────────────────

describe('PORTFOLIO project', () => {
  it('portfolioFlag=true => projectType PORTFOLIO', () => {
    expect(deriveProjectType('BASIC', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('LEGACY', true)).toBe('PORTFOLIO');
  });

  it('deriveBillingPlan retorna null para PORTFOLIO', () => {
    expect(deriveBillingPlan('BASIC', 'PORTFOLIO')).toBeNull();
  });
});

// ─── 4. paymentGracePeriodUntil genera "grace" y no "suspended" ─────────────

describe('payment grace period', () => {
  it('estado grace cuando paymentGracePeriodUntil está en el futuro y status=LIVE', () => {
    const state = deriveBillingVisualState({
      status: 'LIVE',
      paymentGracePeriodUntil: daysFromNow(2),
      suspendedAt: null,
      reactivationFeeActive: false,
    });
    expect(state).toBe('grace');
  });

  it('estado active cuando paymentGracePeriodUntil expiró (null cleared)', () => {
    const state = deriveBillingVisualState({
      status: 'LIVE',
      paymentGracePeriodUntil: null,
      suspendedAt: null,
      reactivationFeeActive: false,
    });
    expect(state).toBe('active');
  });

  it('estado grace retorna copia con variant amber', () => {
    const copy = getBillingStatusCopy('grace');
    expect(copy.variant).toBe('amber');
    expect(copy.label).toBeTruthy();
    expect(copy.description).toBeTruthy();
  });
});

// ─── 5. SUSPENDED sin R01 activo ─────────────────────────────────────────────

describe('SUSPENDED without R01', () => {
  it('día 5 desde suspendedAt => suspended (no r01_active)', () => {
    const now = new Date();
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt: daysAgo(5),
      reactivationFeeActive: false,
      now,
    });
    expect(state).toBe('suspended');
    expect(state).not.toBe('r01_active');
  });

  it('copia suspended tiene variant red', () => {
    const copy = getBillingStatusCopy('suspended');
    expect(copy.variant).toBe('red');
  });
});

// ─── 6. SUSPENDED con reactivationFeeActive=true ─────────────────────────────

describe('SUSPENDED with reactivationFeeActive', () => {
  it('reactivationFeeActive=true => r01_active independientemente de días', () => {
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt: daysAgo(2),
      reactivationFeeActive: true,
    });
    expect(state).toBe('r01_active');
  });

  it('copia r01_active tiene variant red y menciona reactivación', () => {
    const copy = getBillingStatusCopy('r01_active');
    expect(copy.variant).toBe('red');
    expect(copy.label.toLowerCase()).toContain('reactivac');
  });
});

// ─── 7. Día 11+ desde suspendedAt activa R01 visualmente ────────────────────

describe('R01 by day count', () => {
  it('día 11 desde suspensión activa R01', () => {
    expect(isR01ChargeVisibleFromProject(daysAgo(11), false)).toBe(true);
  });

  it('día 15 desde suspensión activa R01', () => {
    expect(isR01ChargeVisibleFromProject(daysAgo(15), false)).toBe(true);
  });

  it('día 11+ => deriveBillingVisualState retorna r01_active', () => {
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt: daysAgo(11),
      reactivationFeeActive: false,
    });
    expect(state).toBe('r01_active');
  });
});

// ─── 8. Día 0-10 desde suspendedAt bloquea R01 ──────────────────────────────

describe('R01 blocked before day 11', () => {
  it('día 0 desde suspensión no activa R01', () => {
    expect(isR01ChargeVisibleFromProject(daysAgo(0), false)).toBe(false);
  });

  it('día 10 desde suspensión no activa R01', () => {
    expect(isR01ChargeVisibleFromProject(daysAgo(10), false)).toBe(false);
  });

  it('día 10 => deriveBillingVisualState retorna suspended (no r01_active)', () => {
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt: daysAgo(10),
      reactivationFeeActive: false,
    });
    expect(state).toBe('suspended');
  });

  it('suspendedAt null => isR01ChargeVisibleFromProject false', () => {
    expect(isR01ChargeVisibleFromProject(null, false)).toBe(false);
  });
});

// ─── 9. Tickets incluidos no aparecen como cobro pendiente ──────────────────

describe('included tickets', () => {
  it('ticket included_setup => clientStatus "included"', () => {
    const s = deriveClientTicketStatus('APPROVED', 'included_setup', 'none');
    expect(s).toBe('included');
  });

  it('ticket included_allowance => clientStatus "included"', () => {
    const s = deriveClientTicketStatus('APPROVED', 'included_allowance', 'none');
    expect(s).toBe('included');
  });

  it('ticket included_warranty => clientStatus "included"', () => {
    const s = deriveClientTicketStatus('APPROVED', 'included_warranty', 'none');
    expect(s).toBe('included');
  });
});

// ─── 10. Tickets con priceAmount > 0 aparecen en solicitudes cobrables ───────

describe('billable tickets', () => {
  it('ticket PAYMENT_PENDING => clientStatus "payment_pending"', () => {
    const s = deriveClientTicketStatus('PAYMENT_PENDING', null, 'none');
    expect(s).toBe('payment_pending');
  });

  it('ticket PAID => clientStatus "paid"', () => {
    const s = deriveClientTicketStatus('PAID', null, 'none');
    expect(s).toBe('paid');
  });

  it('ticket IN_PROGRESS => clientStatus "in_progress"', () => {
    const s = deriveClientTicketStatus('IN_PROGRESS', null, 'none');
    expect(s).toBe('in_progress');
  });

  it('ticket COMPLETED => clientStatus "delivered"', () => {
    const s = deriveClientTicketStatus('COMPLETED', null, 'none');
    expect(s).toBe('delivered');
  });

  it('quote priced => clientStatus "quote_priced"', () => {
    const s = deriveClientTicketStatus('APPROVED', null, 'priced');
    expect(s).toBe('quote_priced');
  });
});

// ─── 11. projectEvents payment_received se transforman en historial ──────────

describe('payment events transform', () => {
  it('totalAmountCents toma prioridad como centavos directos', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: 8900, method: 'PayPal' })).toBe(8900);
  });

  it('grossAmount en dólares se convierte a centavos (89 => 8900)', () => {
    expect(getPaymentEventAmountCents({ grossAmount: 89 })).toBe(8900);
  });

  it('metadata vacío retorna null', () => {
    expect(getPaymentEventAmountCents({})).toBeNull();
  });
});

// ─── 14. Multi-proyecto usa más reciente por defecto ─────────────────────────

describe('multi-project ordering', () => {

  it('getBillingProjectLabel: un proyecto => "Sitio principal"', () => {
    expect(getBillingProjectLabel({ index: 0, total: 1 })).toBe('Sitio principal');
  });

  it('getBillingProjectLabel: múltiples con productionUrl => hostname humano, sin #', () => {
    const label = getBillingProjectLabel({
      index: 0,
      total: 3,
      productionUrl: 'https://www.midominio.com/',
    });
    expect(label).toBe('midominio.com');
    expect(label).not.toContain('#');
    expect(label).not.toBe('Sitio principal');
  });

  it('getBillingProjectLabel: múltiples sin URL => fallback Sitio N (nunca Proyecto #)', () => {
    const label = getBillingProjectLabel({ index: 2, total: 3 });
    expect(label).toBe('Sitio 3');
    expect(label).not.toContain('#');
  });
});

// ─── 15. Portfolio en /facturacion renderiza estado seguro ───────────────────

describe('PORTFOLIO safe render', () => {
  it('PORTFOLIO => no estado grace ni suspendido', () => {
    const state = deriveBillingVisualState({
      status: 'CLOSED',
      paymentGracePeriodUntil: null,
      suspendedAt: null,
      reactivationFeeActive: false,
    });
    expect(['active', 'closed', 'cancelled', 'in_activation'].includes(state)).toBe(true);
    expect(state).not.toBe('grace');
    expect(state).not.toBe('suspended');
    expect(state).not.toBe('r01_active');
  });
});

// ─── 19. getPaymentEventAmountCents — normalización dólares/centavos ─────────

describe('getPaymentEventAmountCents', () => {
  it('{ totalAmountCents: 8900 } => 8900', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: 8900 })).toBe(8900);
  });

  it('{ amountCents: 4900 } => 4900', () => {
    expect(getPaymentEventAmountCents({ amountCents: 4900 })).toBe(4900);
  });

  it('{ grossAmount: 89 } => 8900 (dólares a centavos)', () => {
    expect(getPaymentEventAmountCents({ grossAmount: 89 })).toBe(8900);
  });

  it('{ netAmount: 49 } => 4900 (dólares a centavos)', () => {
    expect(getPaymentEventAmountCents({ netAmount: 49 })).toBe(4900);
  });

  it('{ amount: 25.5 } => 2550 (dólares a centavos)', () => {
    expect(getPaymentEventAmountCents({ amount: 25.5 })).toBe(2550);
  });

  it('{} => null', () => {
    expect(getPaymentEventAmountCents({})).toBeNull();
  });

  it('valores negativos => null', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: -100 })).toBeNull();
  });

  it('NaN => null', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: NaN })).toBeNull();
  });

  it('strings => null', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: '8900' as unknown as number })).toBeNull();
  });

  it('totalAmountCents toma prioridad sobre grossAmount', () => {
    expect(getPaymentEventAmountCents({ totalAmountCents: 8900, grossAmount: 50 })).toBe(8900);
  });
});

// ─── 20. canShowPayPalManagement — PayPal gating ────────────────────────────

describe('canShowPayPalManagement', () => {
  it('SUBSCRIPTION con subscription real y estado active => true', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', 'I-ABC123', 'active')).toBe(true);
  });

  it('SUBSCRIPTION con subscription null => false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', null, 'active')).toBe(false);
  });

  it('SUBSCRIPTION con subscription string vacío => false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', '', 'active')).toBe(false);
  });

  it('SUBSCRIPTION con subscription solo espacios => false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', '   ', 'active')).toBe(false);
  });

  it('LEGACY con subscription real => false', () => {
    expect(canShowPayPalManagement('LEGACY', 'I-ABC123', 'active')).toBe(false);
  });

  it('PORTFOLIO con subscription real => false', () => {
    expect(canShowPayPalManagement('PORTFOLIO', 'I-ABC123', 'active')).toBe(false);
  });

  it('SUBSCRIPTION cancelled => false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', 'I-ABC123', 'cancelled')).toBe(false);
  });

  it('SUBSCRIPTION grace con subscription real => true', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', 'I-ABC123', 'grace')).toBe(true);
  });

  it('SUBSCRIPTION suspended sin subscription => false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', null, 'suspended')).toBe(false);
  });

  it('SUBSCRIPTION r01_active con subscription real => true', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', 'I-ABC123', 'r01_active')).toBe(true);
  });
});

// ─── 21. canShowBillingStatusPayPalCta — CTA en banner ──────────────────────

describe('canShowBillingStatusPayPalCta', () => {
  it('grace con showPayPal=true => true', () => {
    expect(canShowBillingStatusPayPalCta('grace', true)).toBe(true);
  });

  it('suspended con showPayPal=true => true', () => {
    expect(canShowBillingStatusPayPalCta('suspended', true)).toBe(true);
  });

  it('r01_active con showPayPal=true => true', () => {
    expect(canShowBillingStatusPayPalCta('r01_active', true)).toBe(true);
  });

  it('grace con showPayPal=false => false', () => {
    expect(canShowBillingStatusPayPalCta('grace', false)).toBe(false);
  });

  it('suspended con showPayPal=false => false', () => {
    expect(canShowBillingStatusPayPalCta('suspended', false)).toBe(false);
  });

  it('r01_active con showPayPal=false => false', () => {
    expect(canShowBillingStatusPayPalCta('r01_active', false)).toBe(false);
  });

  it('active con showPayPal=true => false', () => {
    expect(canShowBillingStatusPayPalCta('active', true)).toBe(false);
  });

  it('cancelled con showPayPal=true => false', () => {
    expect(canShowBillingStatusPayPalCta('cancelled', true)).toBe(false);
  });

  it('in_activation con showPayPal=true => false', () => {
    expect(canShowBillingStatusPayPalCta('in_activation', true)).toBe(false);
  });
});

// ─── 22. formatMoneyCents con precisión de centavos ─────────────────────────

describe('formatMoneyCents precision', () => {
  it('9900 => "$99 USD"', () => {
    expect(formatMoneyCents(9900)).toBe('$99 USD');
  });

  it('9950 => "$99.50 USD"', () => {
    expect(formatMoneyCents(9950)).toBe('$99.50 USD');
  });

  it('0 => "$0 USD"', () => {
    expect(formatMoneyCents(0)).toBe('$0 USD');
  });

  it('NaN => "$0 USD"', () => {
    expect(formatMoneyCents(NaN)).toBe('$0 USD');
  });

  it('Infinity => "$0 USD"', () => {
    expect(formatMoneyCents(Infinity)).toBe('$0 USD');
  });

  it('8950 => "$89.50 USD"', () => {
    expect(formatMoneyCents(8950)).toBe('$89.50 USD');
  });
});

// ─── 23. BillingStatusBanner PayPal gating — via helpers ────────────────────

describe('BillingStatusBanner PayPal gating via helpers', () => {
  it('SUBSCRIPTION sin subscription null => canShowPayPal false', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', null, 'grace')).toBe(false);
  });

  it('SUBSCRIPTION con subscription real => canShowPayPal true en grace', () => {
    expect(canShowPayPalManagement('SUBSCRIPTION', 'I-REAL123', 'grace')).toBe(true);
  });

  it('Banner sin PayPal en grace => no CTA PayPal', () => {
    expect(canShowBillingStatusPayPalCta('grace', false)).toBe(false);
  });

  it('Banner con PayPal en grace => CTA PayPal visible', () => {
    expect(canShowBillingStatusPayPalCta('grace', true)).toBe(true);
  });

  it('LEGACY nunca activa showPayPal', () => {
    expect(canShowPayPalManagement('LEGACY', 'I-REAL123', 'active')).toBe(false);
  });

  it('PORTFOLIO nunca activa showPayPal', () => {
    expect(canShowPayPalManagement('PORTFOLIO', 'I-REAL123', 'active')).toBe(false);
  });
});

// ─── 24. R01 boundary exacto día 11 vs día 10 ───────────────────────────────

describe('R01 exact day boundary 11 vs 10', () => {
  it('suspendedAt exactamente 11 días atrás => R01 activo', () => {
    const suspendedAt = daysAgo(11);
    expect(isR01ChargeVisibleFromProject(suspendedAt, false)).toBe(true);
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt,
      reactivationFeeActive: false,
    });
    expect(state).toBe('r01_active');
  });

  it('suspendedAt exactamente 10 días atrás => suspendido (no R01)', () => {
    const suspendedAt = daysAgo(10);
    expect(isR01ChargeVisibleFromProject(suspendedAt, false)).toBe(false);
    const state = deriveBillingVisualState({
      status: 'SUSPENDED',
      paymentGracePeriodUntil: null,
      suspendedAt,
      reactivationFeeActive: false,
    });
    expect(state).toBe('suspended');
  });
});

// ─── 25b. getBillingStatusCopy('grace') — helper base neutro ────────────────

describe('getBillingStatusCopy grace base (neutro, sin PayPal)', () => {
  it('variant es amber', () => {
    expect(getBillingStatusCopy('grace').variant).toBe('amber');
  });

  it('label es "Problema de pago"', () => {
    expect(getBillingStatusCopy('grace').label).toBe('Problema de pago');
  });

  it('description NO menciona PayPal', () => {
    expect(getBillingStatusCopy('grace').description.toLowerCase()).not.toContain('paypal');
  });

  it('description menciona soporte o regularizar', () => {
    const desc = getBillingStatusCopy('grace').description.toLowerCase();
    expect(desc.includes('soporte') || desc.includes('regularizar') || desc.includes('regularizar')).toBe(true);
  });
});

// ─── 25. getBillingStatusDisplayCopy — copy contextual PayPal / soporte ──────

describe('getBillingStatusDisplayCopy contextual copy', () => {
  it('grace showPayPal=true => description menciona PayPal', () => {
    const copy = getBillingStatusDisplayCopy('grace', { showPayPal: true });
    expect(copy.description.toLowerCase()).toContain('paypal');
  });

  it('grace showPayPal=false => description NO menciona PayPal', () => {
    const copy = getBillingStatusDisplayCopy('grace', { showPayPal: false });
    expect(copy.description.toLowerCase()).not.toContain('paypal');
  });

  it('grace showPayPal=false => description menciona soporte', () => {
    const copy = getBillingStatusDisplayCopy('grace', { showPayPal: false });
    expect(copy.description.toLowerCase()).toContain('soporte');
  });

  it('grace tiene variant amber en ambos casos', () => {
    expect(getBillingStatusDisplayCopy('grace', { showPayPal: true }).variant).toBe('amber');
    expect(getBillingStatusDisplayCopy('grace', { showPayPal: false }).variant).toBe('amber');
  });

  it('grace sin opciones (undefined) => NO menciona PayPal (showPayPal default false)', () => {
    const copy = getBillingStatusDisplayCopy('grace');
    expect(copy.description.toLowerCase()).not.toContain('paypal');
  });

  it('suspended showPayPal=false => NO menciona PayPal', () => {
    const copy = getBillingStatusDisplayCopy('suspended', { showPayPal: false });
    expect(copy.description.toLowerCase()).not.toContain('paypal');
  });

  it('r01_active showPayPal=false => NO menciona PayPal', () => {
    const copy = getBillingStatusDisplayCopy('r01_active', { showPayPal: false });
    expect(copy.description.toLowerCase()).not.toContain('paypal');
  });

  it('active delega a getBillingStatusCopy', () => {
    const base = getBillingStatusCopy('active');
    const display = getBillingStatusDisplayCopy('active', { showPayPal: false });
    expect(display.label).toBe(base.label);
    expect(display.variant).toBe(base.variant);
  });

  it('cancelled delega a getBillingStatusCopy', () => {
    const base = getBillingStatusCopy('cancelled');
    const display = getBillingStatusDisplayCopy('cancelled', { showPayPal: false });
    expect(display.label).toBe(base.label);
  });
});
