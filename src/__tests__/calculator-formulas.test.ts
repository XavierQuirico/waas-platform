// ============================================================
// Fórmulas de precios de la calculadora
//
// Cubren las reglas de negocio que no pueden cambiar sin revisión: el gross-up
// de PayPal, los descuentos (no acumulables), el piso LEGACY, las cuotas 50/25/25
// y la diferencia entre proyectos LEGACY y suscripciones.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  LEGACY_BASE_PRICE,
  LEGACY_EMERGENCY_FLOOR,
  PAYPAL_FEE_RATE,
  calcAdditionalPages,
  calcBasePrice,
  calcComponentsTotal,
  calcInstallments,
  calcVolumeDiscount,
  calculateQuote,
  ceilTo25,
  ceilTo50,
  formatUSD,
  paypalGrossUp,
} from '@/lib/calculadora/formulas';
import { SUBSCRIPTION_PLANS } from '@/lib/calculadora/catalog-components';
import { getDomainPrice } from '@/lib/calculadora/domain-pricing';
import type { AdjustmentsInput, ClientContextInput } from '@/lib/calculadora/types';

const client = (overrides: Partial<ClientContextInput> = {}): ClientContextInput => ({
  clientName: 'Ana Prueba',
  businessName: 'Negocio Demo',
  niche: 'salud',
  projectType: 'legacy',
  complexityLevel: 'standard',
  contentStatus: 'ready',
  needsBooking: false,
  needsCatalog: false,
  needsCheckout: false,
  needsBlog: false,
  needsMembership: false,
  freeformBrief: '',
  inputMode: 'form',
  ...overrides,
});

const adjustments = (overrides: Partial<AdjustmentsInput> = {}): AdjustmentsInput => ({
  selectedComponents: [],
  exceptionDiscountLevel: 'none',
  exceptionDiscountPercent: 0,
  contractDuration: 'monthly',
  paymentStructure: 'full',
  includePaypalFee: false,
  proposalValidityDays: 7,
  ...overrides,
});

const addOn = (id: string, price: number, quantity?: number) => ({
  componentId: id,
  aiSuggested: false,
  priceOverride: price,
  name: id,
  ...(quantity ? { quantity } : {}),
});

describe('paypalGrossUp', () => {
  it('cobra al cliente lo necesario para que el neto deseado llegue completo', () => {
    const gross = paypalGrossUp(1000);
    // Lo que queda después de la comisión (5,4 % + $0,30) es el neto pedido.
    expect(gross * (1 - PAYPAL_FEE_RATE) - 0.3).toBeCloseTo(1000, 6);
    expect(gross).toBeCloseTo(1057.3996, 3);
  });

  it('el gross-up siempre supera al neto', () => {
    for (const net of [1, 49, 500, 2500]) expect(paypalGrossUp(net)).toBeGreaterThan(net);
  });
});

describe('redondeos', () => {
  it('ceilTo50 redondea hacia arriba al múltiplo de 50', () => {
    expect(ceilTo50(1463)).toBe(1500);
    expect(ceilTo50(2218)).toBe(2250);
    expect(ceilTo50(1500)).toBe(1500);
  });

  it('ceilTo25 redondea hacia arriba al múltiplo de 25', () => {
    expect(ceilTo25(793.13)).toBe(800);
    expect(ceilTo25(396.56)).toBe(400);
    expect(ceilTo25(400)).toBe(400);
  });
});

describe('calcVolumeDiscount', () => {
  it.each([
    [0, 0],
    [3000, 0],
    [3000.01, 0.05],
    [6000, 0.05],
    [6000.01, 0.08],
    [10000, 0.08],
    [10000.01, 0.1],
  ])('subtotal %s → descuento %s', (subtotal, expected) => {
    expect(calcVolumeDiscount(subtotal)).toBe(expected);
  });
});

describe('calcAdditionalPages', () => {
  it.each([
    [1, 0],
    [5, 0],
    [6, 150],
    [10, 750],
    [11, 850],
    [15, 1250],
  ])('%s páginas → $%s adicionales', (pages, expected) => {
    expect(calcAdditionalPages(pages)).toBe(expected);
  });
});

describe('calcComponentsTotal', () => {
  it('suma precio × cantidad y etiqueta las líneas con cantidad', () => {
    const { total, breakdown } = calcComponentsTotal([addOn('A', 100), addOn('B', 40, 3)]);
    expect(total).toBe(220);
    expect(breakdown.map((line) => line.price)).toEqual([100, 120]);
    expect(breakdown[1].name).toBe('B (×3)');
  });

  it('ignora el proyecto base y los ítems sin precio numérico', () => {
    const { total, breakdown } = calcComponentsTotal([
      addOn('base_project', 999),
      { componentId: 'incluido', aiSuggested: true },
      addOn('C', 50),
    ]);
    expect(total).toBe(50);
    expect(breakdown).toHaveLength(1);
  });
});

describe('calcBasePrice', () => {
  it('LEGACY parte de la base de mercado', () => {
    expect(calcBasePrice('legacy')).toBe(LEGACY_BASE_PRICE);
  });

  it('una suscripción usa solo la mensualidad del plan', () => {
    expect(calcBasePrice('subscription', 'pro')).toBe(SUBSCRIPTION_PLANS.pro.monthlyPrice);
    expect(calcBasePrice('subscription')).toBe(0);
  });
});

describe('calcInstallments (50/25/25)', () => {
  it('sin comisión de PayPal redondea cada cuota a $25', () => {
    const result = calcInstallments(2000, false);
    expect([result.installment1, result.installment2, result.installment3]).toEqual([1000, 500, 500]);
    expect(result.totalClientPays).toBe(2000);
    expect(result.providerTotalReceived).toBe(2000);
  });

  it('el redondeo por cuota puede superar levemente el total', () => {
    const result = calcInstallments(1001, false);
    expect([result.installment1, result.installment2, result.installment3]).toEqual([525, 275, 275]);
    expect(result.totalClientPays).toBe(1075);
  });

  it('con comisión de PayPal el proveedor recibe al menos el neto pedido', () => {
    const result = calcInstallments(2000, true);
    expect(result.providerTotalReceived).toBeGreaterThanOrEqual(2000);
    // El sobrecobro por redondeo está acotado: máximo $25 por cuota.
    expect(result.providerTotalReceived).toBeLessThan(2000 + 3 * 25);
    expect(result.paypalFeeI1).toBeGreaterThan(0);
  });
});

describe('calculateQuote — proyectos LEGACY', () => {
  it('un sitio estándar de hasta 5 páginas cuesta la base', () => {
    const quote = calculateQuote(client(), adjustments());
    expect(quote.basePrice).toBe(1500);
    expect(quote.additionalPagesPrice).toBe(0);
    expect(quote.netSubtotal).toBe(1500);
    expect(quote.finalClientPrice).toBe(1500);
    expect(quote.providerNetAmount).toBe(1500);
    expect(quote.paypalFeeIncluded).toBe(false);
    expect(quote.alerts).toEqual([]);
  });

  it('con PayPal el cliente paga el gross-up y el proveedor conserva el neto', () => {
    const quote = calculateQuote(client(), adjustments({ includePaypalFee: true }));
    expect(quote.paypalFeeIncluded).toBe(true);
    expect(quote.finalClientPrice).toBe(Math.round(paypalGrossUp(1500) * 100) / 100);
    expect(quote.finalClientPrice * (1 - PAYPAL_FEE_RATE) - 0.3).toBeCloseTo(1500, 1);
    expect(quote.providerNetAmount).toBe(1500);
  });

  it('la complejidad y las páginas adicionales multiplican la base', () => {
    const quote = calculateQuote(
      client({ numPages: 8, complexityLevel: 'premium' }),
      adjustments(),
    );
    expect(quote.additionalPagesPrice).toBe(450);
    expect(quote.complexityMultiplier).toBe(1.3);
    expect(quote.netSubtotal).toBeCloseTo((1500 + 450) * 1.3, 6);
  });

  it('el descuento por volumen se aplica por encima de $3.000', () => {
    const quote = calculateQuote(
      client({ numPages: 10, complexityLevel: 'ultra_premium' }),
      adjustments(),
    );
    expect(quote.grossSubtotal).toBe(3375);
    expect(quote.volumeDiscountPercent).toBe(0.05);
    expect(quote.netSubtotal).toBeCloseTo(3375 * 0.95, 6);
  });

  it('los descuentos no se acumulan: gana el mayor', () => {
    const volumeWins = calculateQuote(
      client({ numPages: 10, complexityLevel: 'ultra_premium' }),
      adjustments({ exceptionDiscountPercent: 3, exceptionDiscountReason: 'Cliente recurrente' }),
    );
    expect(volumeWins.finalDiscountPercent).toBe(0.05);

    const exceptionWins = calculateQuote(
      client({ numPages: 8, complexityLevel: 'premium' }),
      adjustments({ exceptionDiscountPercent: 10, exceptionDiscountReason: 'Acuerdo comercial' }),
    );
    expect(exceptionWins.finalDiscountPercent).toBeCloseTo(0.1, 10);
    expect(exceptionWins.netSubtotal).toBeCloseTo(2535 * 0.9, 6);
  });

  it('un descuento en monto fijo se convierte a su porcentaje equivalente', () => {
    const quote = calculateQuote(
      client(),
      adjustments({ discountFixedAmount: 300, exceptionDiscountReason: 'Promoción' }),
    );
    expect(quote.exceptionDiscountPercent).toBeCloseTo(0.2, 10);
    expect(quote.netSubtotal).toBeCloseTo(1200, 6);
  });

  it('nunca baja del piso de emergencia y avisa del ajuste', () => {
    const quote = calculateQuote(
      client(),
      adjustments({ exceptionDiscountPercent: 50, exceptionDiscountReason: 'Caso solidario' }),
    );
    expect(quote.netSubtotal).toBe(LEGACY_EMERGENCY_FLOOR);
    expect(quote.alerts.some((alert) => alert.includes('piso de emergencia'))).toBe(true);
  });

  it('avisa cuando se aplica un descuento sin motivo registrado', () => {
    const quote = calculateQuote(client(), adjustments({ exceptionDiscountPercent: 10 }));
    expect(quote.alerts.some((alert) => alert.includes('sin motivo'))).toBe(true);
  });

  it('genera cuotas solo cuando se elige pago en cuotas', () => {
    const full = calculateQuote(client(), adjustments());
    expect(full.installments).toBeUndefined();

    const split = calculateQuote(
      client(),
      adjustments({ paymentStructure: 'installments', selectedComponents: [addOn('A', 500)] }),
    );
    expect(split.netSubtotal).toBe(2000);
    expect(split.installments?.totalClientPays).toBe(2000);
  });

  it('avisa si las cuotas se piden para un monto menor a $1.000', () => {
    const quote = calculateQuote(
      client(),
      adjustments({
        paymentStructure: 'installments',
        exceptionDiscountPercent: 50,
        exceptionDiscountReason: 'Caso solidario',
      }),
    );
    expect(quote.alerts.some((alert) => alert.includes('Las cuotas aplican'))).toBe(true);
  });

  it('incluye mantenimiento mensual solo si se activa', () => {
    const without = calculateQuote(client(), adjustments({ maintenanceMonthlyAmount: 75 }));
    expect(without.maintenanceMonthlyAmount).toBe(0);

    const withMaintenance = calculateQuote(
      client(),
      adjustments({ includeMaintenanceFee: true, maintenanceMonthlyAmount: 75 }),
    );
    expect(withMaintenance.maintenanceMonthlyAmount).toBe(75);
  });

  it('cotiza el dominio cuando lo compra el proveedor para el cliente', () => {
    const quote = calculateQuote(
      client({ domainTarget: 'ejemplo.com' }),
      adjustments({ domainStatus: 'client_will_buy' }),
    );
    expect(quote.domainPrice).toBe(getDomainPrice('ejemplo.com'));
    expect(quote.domainTarget).toBe('ejemplo.com');
  });

  it('3 o más add-ons de pago reciben 10 % de descuento sobre los add-ons', () => {
    const two = calculateQuote(
      client(),
      adjustments({ selectedComponents: [addOn('A', 100), addOn('B', 100)] }),
    );
    expect(two.addOnDiscountPercent).toBe(0);
    expect(two.netAddOnsTotal).toBe(200);

    const three = calculateQuote(
      client(),
      adjustments({ selectedComponents: [addOn('A', 100), addOn('B', 100), addOn('C', 100)] }),
    );
    expect(three.addOnDiscountPercent).toBe(0.1);
    expect(three.addOnDiscountAmount).toBe(30);
    expect(three.netAddOnsTotal).toBe(270);
  });
});

describe('calculateQuote — suscripciones', () => {
  const subscription = (overrides: Partial<ClientContextInput> = {}) =>
    client({ projectType: 'subscription', subscriptionPlan: 'basic', ...overrides });

  it('cobra la mensualidad del plan y el setup aparte', () => {
    const quote = calculateQuote(subscription(), adjustments());
    expect(quote.basePrice).toBe(SUBSCRIPTION_PLANS.basic.monthlyPrice);
    expect(quote.setupFeeAmount).toBe(SUBSCRIPTION_PLANS.basic.setupFee);
    expect(quote.netSubtotal).toBe(49);
    expect(quote.providerNetAmount).toBe(99);
  });

  it('el setup puede omitirse', () => {
    const quote = calculateQuote(subscription({ includeSetupFee: false }), adjustments());
    expect(quote.setupFeeAmount).toBe(0);
    expect(quote.providerNetAmount).toBe(49);
  });

  it('no aplica el gross-up de PayPal: la plataforma lo cobra por suscripción', () => {
    const quote = calculateQuote(subscription(), adjustments({ includePaypalFee: true }));
    expect(quote.paypalFeeIncluded).toBe(false);
  });

  it('calcula el MRR y el primer cobro netos de la comisión de PayPal', () => {
    const quote = calculateQuote(subscription(), adjustments());
    expect(quote.mrrNeto).toBe(46.05);
    expect(quote.primerCobroClienteTotal).toBe(99);
    expect(quote.primerCobroNeto).toBe(93.35);
  });

  it('el contrato anual descuenta 10 % solo sobre el precio base del plan', () => {
    const quote = calculateQuote(
      subscription(),
      adjustments({
        contractDuration: 'annual',
        selectedComponents: [addOn('A', 20)],
      }),
    );
    expect(quote.durationDiscountPercent).toBe(0.1);
    expect(quote.durationDiscountAmount).toBe(4.9);
    expect(quote.planAnnualBase).toBe(588);
    expect(quote.planAnnualAfterDiscount).toBe(529.2);
    // El add-on no recibe el descuento por duración.
    expect(quote.netSubtotal).toBeCloseTo(49 + 20 - 4.9, 6);
  });

  it('no aplica páginas adicionales ni complejidad', () => {
    const quote = calculateQuote(
      subscription({ numPages: 12, complexityLevel: 'ultra_premium' }),
      adjustments(),
    );
    expect(quote.additionalPagesPrice).toBe(0);
    expect(quote.netSubtotal).toBe(49);
  });
});

describe('formatUSD', () => {
  it('formatea montos enteros y con centavos', () => {
    expect(formatUSD(1500)).toBe('$1,500');
    expect(formatUSD(49.5)).toBe('$49.5');
  });
});
