// ============================================================
// GET /api/paypal/plan-id?plan=BASIC
// Público — expone el plan_id de PayPal para el frontend
// El frontend necesita el planId para inicializar el botón de PayPal
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PAYPAL_PLAN_IDS } from '@/lib/paypal/plans';
import type { SubscriptionPlan } from '@/lib/paypal/plans';

const VALID_PLANS: SubscriptionPlan[] = ['BASIC', 'PRO', 'BUSINESS'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const planParam = searchParams.get('plan')?.toUpperCase() as SubscriptionPlan | null;

  // Validar plan
  if (!planParam || !VALID_PLANS.includes(planParam)) {
    return NextResponse.json(
      { error: `Plan inválido. Valores aceptados: ${VALID_PLANS.join(', ')}` },
      { status: 400 }
    );
  }

  const planId = PAYPAL_PLAN_IDS[planParam];

  // Si el plan ID no está configurado en las variables de entorno
  if (!planId) {
    return NextResponse.json(
      {
        error: `PAYPAL_PLAN_ID_${planParam} no está configurado. Ejecuta POST /api/paypal/setup-plans primero.`,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ planId });
}
