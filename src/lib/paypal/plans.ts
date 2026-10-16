// ============================================================
// PayPal Plan IDs & Pricing — WaaS
// Los plan IDs se generan UNA VEZ via /api/paypal/setup-plans
// y se almacenan en variables de entorno.
// ============================================================

export type SubscriptionPlan = 'BASIC' | 'PRO' | 'BUSINESS';

export const PAYPAL_PLAN_IDS: Record<SubscriptionPlan, string> = {
  BASIC:    process.env.PAYPAL_PLAN_ID_BASIC    ?? '',
  PRO:      process.env.PAYPAL_PLAN_ID_PRO      ?? '',
  BUSINESS: process.env.PAYPAL_PLAN_ID_BUSINESS ?? '',
};

export const PLAN_MONTHLY_PRICE_CENTS: Record<SubscriptionPlan, number> = {
  BASIC:    4900,   // $49.00 USD
  PRO:      8900,   // $89.00 USD
  BUSINESS: 13900,  // $139.00 USD
};

export const SETUP_FEE_CENTS = 5000; // $50.00 USD

export function getPlanPriceUSD(plan: SubscriptionPlan): string {
  return (PLAN_MONTHLY_PRICE_CENTS[plan] / 100).toFixed(2);
}

/**
 * Valida que los plan IDs de PayPal estén configurados en producción.
 * Llamar durante el arranque del servidor o en la primera solicitud.
 * En desarrollo, los IDs pueden estar vacíos sin error.
 */
export function assertPlanIdsConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const missing = (Object.entries(PAYPAL_PLAN_IDS) as [SubscriptionPlan, string][])
    .filter(([, id]) => !id)
    .map(([plan]) => `PAYPAL_PLAN_ID_${plan}`);
  if (missing.length > 0) {
    throw new Error(`[PayPal] Variables de entorno faltantes en producción: ${missing.join(', ')}`);
  }
}
