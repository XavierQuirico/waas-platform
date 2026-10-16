// ============================================================
// POST /api/paypal/setup-plans
// ADMIN-ONLY — ejecutar UNA SOLA VEZ para crear los planes en PayPal.
// Protección (ambas): sesión de administrador + header x-admin-secret igual a
// process.env.ADMIN_SETUP_SECRET (comparación en tiempo constante).
// Retorna los plan IDs para copiar en .env
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/auth';
import { safeEqual } from '@/lib/security/safe-compare';
import { paypalFetch } from '@/lib/paypal/client';
import { getPlanPriceUSD } from '@/lib/paypal/plans';
import type { SubscriptionPlan } from '@/lib/paypal/plans';

interface PayPalProduct {
  id: string;
  name: string;
}

interface PayPalPlan {
  id: string;
  name: string;
  status: string;
}

interface PlanDefinition {
  key: SubscriptionPlan;
  name: string;
  description: string;
  priceUSD: string;
}

async function createOrGetProduct(): Promise<string> {
  // Intentar listar productos existentes para evitar duplicados
  const listing = await paypalFetch<{ products: PayPalProduct[] }>(
    '/v1/catalogs/products?page_size=20',
    'GET'
  );

  const existing = listing.products?.find((p) => p.name === 'WaaS Platform');
  if (existing) return existing.id;

  const product = await paypalFetch<PayPalProduct>('/v1/catalogs/products', 'POST', {
    name: 'WaaS Platform',
    description: 'Sitio web profesional con suscripción mensual — QUIRICO STUDIOS',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });

  return product.id;
}

async function createPlan(productId: string, def: PlanDefinition): Promise<string> {
  const plan = await paypalFetch<PayPalPlan>('/v1/billing/plans', 'POST', {
    product_id: productId,
    name: `WaaS ${def.key}`,
    description: def.description,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // infinito
        pricing_scheme: {
          fixed_price: {
            value: def.priceUSD,
            currency_code: 'USD',
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '50.00',
        currency_code: 'USD',
      },
      setup_fee_failure_action: 'CANCEL',
      payment_failure_threshold: 3,
    },
  });

  return plan.id;
}

export async function POST(req: NextRequest) {
  // Verificar sesión de administrador y secret de configuración
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!safeEqual(req.headers.get('x-admin-secret'), process.env.ADMIN_SETUP_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Crear o recuperar producto
    const productId = await createOrGetProduct();

    // 2. Definir los tres planes
    const planDefs: PlanDefinition[] = [
      {
        key: 'BASIC',
        name: 'WaaS BASIC',
        description: 'Sitio web profesional - Plan BASIC',
        priceUSD: getPlanPriceUSD('BASIC'),
      },
      {
        key: 'PRO',
        name: 'WaaS PRO',
        description: 'Sitio web profesional con reservas - Plan PRO',
        priceUSD: getPlanPriceUSD('PRO'),
      },
      {
        key: 'BUSINESS',
        name: 'WaaS BUSINESS',
        description: 'Sitio web con e-commerce y catálogo - Plan BUSINESS',
        priceUSD: getPlanPriceUSD('BUSINESS'),
      },
    ];

    // 3. Crear los tres planes en paralelo
    const [basicId, proId, businessId] = await Promise.all(
      planDefs.map((def) => createPlan(productId, def))
    );

    // 4. Retornar los IDs para copiar en .env
    const result = {
      PAYPAL_PLAN_ID_BASIC: basicId,
      PAYPAL_PLAN_ID_PRO: proId,
      PAYPAL_PLAN_ID_BUSINESS: businessId,
      _instructions: 'Copia estos valores en tu .env y reinicia el servidor.',
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[PayPal] Error creando planes:', err);
    return NextResponse.json({ error: 'No se pudieron crear los planes.' }, { status: 500 });
  }
}
