// ============================================================
// Fórmulas Determinísticas WaaS — Calculadora Interna
// NUNCA cambiar estas fórmulas sin validar con los casos de prueba
// ============================================================

import type {
  CalculationResult,
  AdjustmentsInput,
  ClientContextInput,
  ComplexityMultiplier,
  ContractDuration,
  SelectedComponent,
  DomainStatus,
} from './types';
import { getDomainPrice } from './domain-pricing';
import { SUBSCRIPTION_PLANS } from './catalog-components';

// ─── Constantes PayPal ────────────────────────────────────
/** Tasa porcentual de comisión PayPal (5.4%). Exportada para uso en UI. */
export const PAYPAL_FEE_RATE = 0.054; // 5.4%
const PAYPAL_PERCENT = PAYPAL_FEE_RATE;
const PAYPAL_FIXED = 0.30;    // $0.30 por transacción

// ─── Multiplicadores de complejidad ──────────────────────
const COMPLEXITY_MULTIPLIERS: Record<string, ComplexityMultiplier> = {
  standard:      1.0,
  premium:       1.3,
  ultra_premium: 1.5,
};

// ─── Límites de descuento por volumen ────────────────────
const VOLUME_DISCOUNT_TIERS = [
  { threshold: 10000, percent: 0.10 },
  { threshold: 6000,  percent: 0.08 },
  { threshold: 3000,  percent: 0.05 },
  { threshold: 0,     percent: 0.00 },
];

// ─── Precio base LEGACY ───────────────────────────────────
/**
 * Precio base real de mercado para proyectos LEGACY.
 * Este es el punto de partida mínimo — un sitio corporativo estándar de hasta 5 páginas.
 * Documentado en ENTRY_POINT_TABLE como punto de entrada más bajo.
 */
export const LEGACY_BASE_PRICE = 1500;

/**
 * Piso absoluto de emergencia LEGACY.
 * Solo alcanzable cuando el admin aplica explícitamente un descuento por excepción
 * (solidario extremo / precio de favor). El sistema NUNCA calcula hasta aquí por defecto.
 */
export const LEGACY_EMERGENCY_FLOOR = 800;

// ─── Descuentos por duración de contrato ─────────────────
// Solo aplican a planes de suscripción. No afectan proyectos LEGACY.
const DURATION_DISCOUNTS: Record<ContractDuration, number> = {
  monthly: 0.00,  // Sin compromiso adicional
  annual:  0.10,  // -10% por compromiso anual (12 meses)
};

/**
 * Aplica el gross-up de PayPal para que el admin reciba el monto neto deseado.
 * Fórmula exacta: (monto + $0.30) / (1 - 0.054)
 */
export function paypalGrossUp(netAmount: number): number {
  return (netAmount + PAYPAL_FIXED) / (1 - PAYPAL_PERCENT);
}

/**
 * Redondea hacia arriba al múltiplo de 50 más cercano.
 * Ej: 1,463 → 1,500 | 2,218 → 2,250
 */
export function ceilTo50(amount: number): number {
  return Math.ceil(amount / 50) * 50;
}

/**
 * Redondea hacia arriba al múltiplo de 25 más cercano.
 * Usado para cuotas individuales.
 * Ej: 793.13 → 800 | 396.56 → 400
 */
export function ceilTo25(amount: number): number {
  return Math.ceil(amount / 25) * 25;
}

/**
 * Calcula el descuento por volumen basado en el subtotal bruto.
 */
export function calcVolumeDiscount(subtotal: number): number {
  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (subtotal > tier.threshold) return tier.percent;
  }
  return 0;
}

/**
 * Calcula el precio de páginas adicionales según la tabla de Sección 1.
 * - Páginas 1–5: incluidas en base
 * - Páginas 6–10: $150/pág
 * - Página 11+: $100/pág
 */
export function calcAdditionalPages(numPages: number): number {
  if (numPages <= 5) return 0;

  let total = 0;
  const pagesIn6to10 = Math.min(numPages, 10) - 5;
  const pagesFrom11 = Math.max(numPages - 10, 0);

  total += pagesIn6to10 * 150;
  total += pagesFrom11 * 100;
  return total;
}

/**
 * Suma los precios de los componentes seleccionados.
 * Usa priceOverride exclusivamente para el precio — establecido desde el catálogo
 * vivo en el momento de la selección (AIComponentSuggestion).
 * Ignora items sin priceOverride numérico (included, quote, no seleccionables).
 * No requiere acceso activo al catálogo para calcular precios.
 */
export function calcComponentsTotal(selectedComponents: SelectedComponent[]): {
  total: number;
  breakdown: Array<{ id: string; name: string; price: number; section: string }>;
} {
  let total = 0;
  const breakdown: Array<{ id: string; name: string; price: number; section: string }> = [];

  for (const sel of selectedComponents) {
    // Guardia de seguridad por si algún estado viejo tuviera base_project
    if (sel.componentId === 'base_project') continue;

    // priceOverride es la fuente de precio (establecido desde cataálogo vivo
    // al seleccionar el componente en AIComponentSuggestion).
    // Items sin priceOverride numérico (included, quote) no suman al total.
    const unitPrice = typeof sel.priceOverride === 'number' ? sel.priceOverride : null;
    if (unitPrice === null) continue;

    const qty = sel.quantity ?? 1;
    const lineTotal = unitPrice * qty;
    total += lineTotal;

    breakdown.push({
      id: sel.componentId,
      // Nombre: embebido en la selección desde el catálogo vivo.
      // Fallback al componentId para snapshots legacy sin campo name.
      name: qty > 1
        ? `${sel.name ?? sel.componentId} (×${qty})`
        : (sel.name ?? sel.componentId),
      price: lineTotal,
      section: sel.sectionName ?? 'Add-on',
    });
  }

  return { total, breakdown };
}

/**
 * Calcula las cuotas (50/25/25).
 * Si includePaypalFee=true: cada cuota se aplica gross-up PayPal individual y se redondea a $25.
 * Si includePaypalFee=false: cuotas simples sin gross-up, redondeadas a $25.
 *
 * ROUNDING INTENCIONAL: la suma de las 3 cuotas puede diferir levemente del total
 * por el redondeo independiente de cada cuota. Esto es esperado y beneficia al admin.
 */
export function calcInstallments(
  netSubtotal: number,
  includePaypalFee: boolean
): {
  installment1: number;
  installment2: number;
  installment3: number;
  totalClientPays: number;
  providerTotalReceived: number;
  paypalFeeI1: number;
  paypalFeeI2: number;
  paypalFeeI3: number;
} {
  const gross1 = netSubtotal * 0.50;
  const gross2 = netSubtotal * 0.25;
  const gross3 = netSubtotal * 0.25;

  let i1: number, i2: number, i3: number;
  let feeI1 = 0, feeI2 = 0, feeI3 = 0;

  if (includePaypalFee) {
    i1 = ceilTo25(paypalGrossUp(gross1));
    i2 = ceilTo25(paypalGrossUp(gross2));
    i3 = ceilTo25(paypalGrossUp(gross3));
    // Fee aproximado por cuota (para display informativo)
    feeI1 = Math.round((i1 - gross1) * 100) / 100;
    feeI2 = Math.round((i2 - gross2) * 100) / 100;
    feeI3 = Math.round((i3 - gross3) * 100) / 100;
  } else {
    i1 = ceilTo25(gross1);
    i2 = ceilTo25(gross2);
    i3 = ceilTo25(gross3);
  }

  const totalClientPays = i1 + i2 + i3;

  let providerTotalReceived: number;
  if (includePaypalFee) {
    const providerFromI1 = i1 * (1 - PAYPAL_PERCENT) - PAYPAL_FIXED;
    const providerFromI2 = i2 * (1 - PAYPAL_PERCENT) - PAYPAL_FIXED;
    const providerFromI3 = i3 * (1 - PAYPAL_PERCENT) - PAYPAL_FIXED;
    providerTotalReceived = Math.round((providerFromI1 + providerFromI2 + providerFromI3) * 100) / 100;
  } else {
    providerTotalReceived = Math.round(totalClientPays * 100) / 100;
  }

  return {
    installment1: i1,
    installment2: i2,
    installment3: i3,
    totalClientPays,
    providerTotalReceived,
    paypalFeeI1: feeI1,
    paypalFeeI2: feeI2,
    paypalFeeI3: feeI3,
  };
}

/**
 * Calcula la base del proyecto según el tipo.
 * - LEGACY: $1,500 base de mercado real (hasta 5 páginas, complejidad estándar)
 * - Suscripción: solo mensualidad del plan elegido (setup fee se calcula separado en calculateQuote)
 */
export function calcBasePrice(
  projectType: 'subscription' | 'legacy',
  subscriptionPlan?: 'basic' | 'pro' | 'business',
): number {
  if (projectType === 'legacy') return LEGACY_BASE_PRICE;
  if (!subscriptionPlan) return 0;
  const plan = SUBSCRIPTION_PLANS[subscriptionPlan];
  return plan.monthlyPrice; // Solo mensualidad — setup fee va separado
}

/**
 * Función principal de cálculo — completamente determinística.
 * Sin IA, sin efectos secundarios.
 */
export function calculateQuote(
  clientInput: ClientContextInput,
  adjustments: AdjustmentsInput
): CalculationResult {
  const alerts: string[] = [];
  const isLegacy = clientInput.projectType === 'legacy';

  // ─── 1. Base del proyecto ──────────────────────────────
  const basePrice = calcBasePrice(
    clientInput.projectType,
    clientInput.subscriptionPlan,
  );

  // Setup fee — fuera del pipeline de descuentos (solo suscripción)
  const setupFeeAmount = (!isLegacy && (clientInput.includeSetupFee !== false))
    ? (SUBSCRIPTION_PLANS[clientInput.subscriptionPlan!]?.setupFee ?? 0)
    : 0;

  // ─── 2. Páginas adicionales (solo LEGACY) ──────────────
  const additionalPagesPrice = isLegacy
    ? calcAdditionalPages(clientInput.numPages ?? 5)
    : 0;

  // ─── 3. Multiplicador de complejidad (solo LEGACY) ─────
  const complexityMultiplier: ComplexityMultiplier =
    COMPLEXITY_MULTIPLIERS[clientInput.complexityLevel] ?? 1.0;

  const baseWithComplexity = isLegacy
    ? (basePrice + additionalPagesPrice) * complexityMultiplier
    : basePrice;

  // ─── 4. Componentes seleccionados ─────────────────────
  const { total: componentsTotal, breakdown: componentsBreakdown } =
    calcComponentsTotal(adjustments.selectedComponents);

  // ─── 4b. Descuento por volumen de add-ons (3+ add-ons = 10%) ──
  const ADD_ON_VOLUME_THRESHOLD = 3;
  const ADD_ON_VOLUME_DISCOUNT_RATE = 0.10;
  const numPaidAddOns = componentsBreakdown.length;
  const addOnDiscountPercent = numPaidAddOns >= ADD_ON_VOLUME_THRESHOLD ? ADD_ON_VOLUME_DISCOUNT_RATE : 0;
  const addOnDiscountAmount = Math.round(componentsTotal * addOnDiscountPercent * 100) / 100;
  const netAddOnsTotal = componentsTotal - addOnDiscountAmount;

  // ─── 5. Subtotal bruto ────────────────────────────────
  const grossSubtotal = baseWithComplexity + netAddOnsTotal;

  // ─── 6. Descuentos ────────────────────────────────────
  const volumeDiscountPercent = calcVolumeDiscount(grossSubtotal);
  const volumeDiscountAmount = grossSubtotal * volumeDiscountPercent;

  // Si hay descuento en monto fijo, calcular el % equivalente
  const effectiveExceptionPercent = adjustments.discountFixedAmount && adjustments.discountFixedAmount > 0
    ? (adjustments.discountFixedAmount / grossSubtotal) * 100
    : adjustments.exceptionDiscountPercent;
  const exceptionDiscountPercent = effectiveExceptionPercent / 100;
  const exceptionDiscountAmount = grossSubtotal * exceptionDiscountPercent;

  // Aplica el mayor entre volumen y excepción (no acumulan)
  const finalDiscountPercent = Math.max(volumeDiscountPercent, exceptionDiscountPercent);
  const finalDiscountAmount = grossSubtotal * finalDiscountPercent;

  // ─── 7. Subtotal neto post-descuento ─────────────────
  let netSubtotal = grossSubtotal - finalDiscountAmount;

  // ─── 7b. Descuento por duración (solo suscripción) ────
  const durationDiscountPercent = !isLegacy
    ? DURATION_DISCOUNTS[adjustments.contractDuration ?? 'monthly']
    : 0;
  // CRITICAL BUSINESS RULE: el descuento por duración aplica SOLO al precio base del plan,
  // no a los add-ons ni al subtotal completo.
  const durationDiscountAmount = !isLegacy
    ? Math.round(basePrice * durationDiscountPercent * 100) / 100
    : 0;
  netSubtotal = netSubtotal - durationDiscountAmount;

  // ─── 8. Verificar piso LEGACY ─────────────────────────
  if (isLegacy && netSubtotal < LEGACY_EMERGENCY_FLOOR) {
    alerts.push(
      `El descuento aplicado llevaría el neto a $${netSubtotal.toFixed(2)}, por debajo del piso de emergencia de $${LEGACY_EMERGENCY_FLOOR}. Se ajustó automáticamente.`
    );
    netSubtotal = LEGACY_EMERGENCY_FLOOR;
  }

  // ─── 9. Servicios recurrentes LEGACY ──────────────────
  const maintenanceMonthlyAmount = (isLegacy && adjustments.includeMaintenanceFee)
    ? (adjustments.maintenanceMonthlyAmount ?? 0)
    : 0;

  const dedicatedServerMonthlyCost = (isLegacy && adjustments.includeDedicatedServer)
    ? (adjustments.dedicatedServerMonthlyCost ?? 0)
    : 0;

  const domainStatus: DomainStatus = adjustments.domainStatus ?? (
    clientInput.hasDomain === true ? 'client_has_domain' :
    clientInput.hasDomain === false ? 'client_will_buy' :
    'none'
  );

  const domainPrice = domainStatus === 'client_will_buy'
    ? getDomainPrice(clientInput.domainTarget ?? '')
    : undefined;
  const domainTargetValue = domainStatus === 'client_will_buy' && clientInput.domainTarget
    ? clientInput.domainTarget
    : undefined;

  // ─── 10. PayPal gross-up (condicional) ────────────────
  const includePaypalFee = isLegacy ? (adjustments.includePaypalFee ?? true) : false;

  let paypalFeeAmount = 0;
  let finalClientPrice = netSubtotal;
  let finalClientPriceRounded = Math.round(netSubtotal * 100) / 100;

  if (includePaypalFee) {
    const grossedUp = paypalGrossUp(netSubtotal);
    paypalFeeAmount = Math.round((grossedUp - netSubtotal) * 100) / 100;
    finalClientPrice = Math.round(grossedUp * 100) / 100;
    finalClientPriceRounded = Math.round(grossedUp * 100) / 100;
  }

  const providerNetAmount = isLegacy
    ? Math.round(netSubtotal * 100) / 100
    : Math.round((netSubtotal + setupFeeAmount) * 100) / 100;

  // ─── 11. Cuotas (solo LEGACY con paymentStructure installments) ──
  let installments: CalculationResult['installments'];
  if (isLegacy && adjustments.paymentStructure === 'installments') {
    if (netSubtotal < 1000) {
      alerts.push('Las cuotas aplican para proyectos ≥ $1,000. Se calcularon de todos modos.');
    }
    installments = calcInstallments(netSubtotal, includePaypalFee);
  }

  // ─── Validaciones adicionales ─────────────────────────
  if (adjustments.exceptionDiscountPercent > 0 && !adjustments.exceptionDiscountReason) {
    alerts.push('Se aplicó descuento por excepción sin motivo registrado. Recomendado: agrega el motivo para el historial interno.');
  }

  // ─── Desglose para el resultado ──────────────────────
  const allComponents = [
    {
      id: 'base_price_display',
      name: isLegacy
        ? `Proyecto base hasta 5 páginas${complexityMultiplier > 1 ? ` × complejidad ${complexityMultiplier}×` : ''}`
        : `Plan ${clientInput.subscriptionPlan?.toUpperCase() ?? ''} — mensualidad`,
      price: baseWithComplexity,
      section: 'Base',
    },
    ...(additionalPagesPrice > 0
      ? [{
          id: 'pages_extra_display',
          name: `Páginas adicionales (${(clientInput.numPages ?? 5) - 5} págs.)`,
          price: additionalPagesPrice * complexityMultiplier, // ya incluido en baseWithComplexity — esto es informativo
          section: 'Base',
        }]
      : []),
    ...componentsBreakdown,
  ];

  // ─── Totales anuales (solo suscripción anual) ─────────
  const isAnnual = !isLegacy && adjustments.contractDuration === 'annual';
  const planAnnualBase = isAnnual
    ? Math.round(basePrice * 12 * 100) / 100
    : undefined;
  const planAnnualAfterDiscount = isAnnual
    ? Math.round(basePrice * 12 * 0.90 * 100) / 100
    : undefined;

  // ─── Métricas internas de suscripción (solo para el admin) ──
  let mrrNeto: number | undefined;
  let primerCobroNeto: number | undefined;
  let primerCobroClienteTotal: number | undefined;

  if (!isLegacy) {
    const planPrimerCobro = isAnnual
      ? (planAnnualAfterDiscount ?? basePrice * 12 * 0.9)
      : basePrice;
    primerCobroClienteTotal = planPrimerCobro + netAddOnsTotal + setupFeeAmount;
    primerCobroNeto = Math.round(
      (primerCobroClienteTotal * (1 - PAYPAL_FEE_RATE) - PAYPAL_FIXED) * 100
    ) / 100;
    mrrNeto = Math.round(
      (basePrice * (1 - PAYPAL_FEE_RATE) - PAYPAL_FIXED) * 100
    ) / 100;
  }

  return {
    components: allComponents,
    basePrice,
    additionalPagesPrice,
    complexityMultiplier,
    componentsTotal,
    grossSubtotal,
    volumeDiscountPercent,
    volumeDiscountAmount,
    exceptionDiscountPercent,
    exceptionDiscountAmount,
    finalDiscountPercent,
    finalDiscountAmount,
    durationDiscountPercent,
    durationDiscountAmount,
    netSubtotal,
    setupFeeAmount,
    maintenanceMonthlyAmount,
    dedicatedServerMonthlyCost,
    domainStatus,
    domainPrice,
    domainTarget: domainTargetValue,
    paypalFeeIncluded: includePaypalFee,
    paypalFeeAmount,
    finalClientPrice,
    finalClientPriceRounded,
    providerNetAmount,
    addOnDiscountPercent,
    addOnDiscountAmount,
    netAddOnsTotal,
    mrrNeto,
    primerCobroNeto,
    primerCobroClienteTotal,
    planAnnualBase,
    planAnnualAfterDiscount,
    installments,
    alerts,
  };
}

/**
 * Formatea un monto como USD para mostrar en la UI.
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calcula la fecha de entrega en staging (72h hábiles desde hoy).
 * Excluye fines de semana. No incluye festivos dominicanos (manual).
 */
export function calcStagingDeadline(startDate: Date = new Date()): Date {
  let businessHours = 0;
  const deadline = new Date(startDate);

  while (businessHours < 72) {
    deadline.setHours(deadline.getHours() + 1);
    const day = deadline.getDay();
    const hour = deadline.getHours();
    // Lunes a Viernes, 8am–6pm
    if (day >= 1 && day <= 5 && hour >= 8 && hour < 18) {
      businessHours++;
    }
  }

  return deadline;
}

/**
 * Verifica si una cotización ha expirado.
 */
export function isQuoteExpired(createdAt: Date, validityDays: number): boolean {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + validityDays);
  return new Date() > expiryDate;
}
