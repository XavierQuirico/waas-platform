// ============================================================
// POST /api/paypal/confirm-payment
// Se llama desde el frontend después de que PayPal aprueba la
// suscripción (onApprove). Crea/actualiza Client y Project en DB y
// dispara Inngest.
//
// Endurecimiento:
//  - Solo se acepta una suscripción ACTIVE (pago realmente efectuado).
//  - El plan configurado es obligatorio: si falta, se rechaza (falla cerrado).
//  - El snapshot del intake se valida con el schema real del wizard.
//  - La aceptación de términos se registra con la hora del servidor.
//  - Nunca se adjunta un proyecto a una cuenta con usuario real ajeno.
//  - Los errores internos no se devuelven al cliente.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { clients, projects, projectEvents } from '@/db/schema';
import { paypalFetch } from '@/lib/paypal/client';
import {
  PAYPAL_PLAN_IDS,
  PLAN_MONTHLY_PRICE_CENTS,
  SETUP_FEE_CENTS,
  assertPlanIdsConfigured,
} from '@/lib/paypal/plans';
import type { SubscriptionPlan } from '@/lib/paypal/plans';
import { inngest } from '@/inngest/client';
import { intakeSubmitSchema } from '@/lib/intake/schema';
import type { IntakeSnapshot } from '@/db/schema/projects';

// ─── Validación de body ───────────────────────────────────

const confirmPaymentSchema = z.object({
  subscriptionId: z.string().regex(/^[A-Za-z0-9_-]{3,64}$/),
  plan: z.enum(['BASIC', 'PRO', 'BUSINESS']),
  intakeSnapshot: z.record(z.unknown()),
  termsVersion: z.string().min(1).max(20),
});

type ConfirmPaymentBody = z.infer<typeof confirmPaymentSchema>;

// ─── Respuesta de PayPal al consultar una suscripción ─────

interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
}

const PENDING_PREFIX = 'pending_';

function clientIpFrom(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  return ip.slice(0, 45);
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// ─── Handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Clerk user si existe (puede ser null para clientes nuevos no autenticados).
  const { userId } = await auth();

  // 1. Validar body
  let body: ConfirmPaymentBody;
  try {
    body = confirmPaymentSchema.parse(await req.json());
  } catch {
    return fail(400, 'Solicitud inválida.');
  }

  const intakeResult = intakeSubmitSchema.safeParse(body.intakeSnapshot);
  if (!intakeResult.success) {
    return fail(400, 'Los datos del formulario no son válidos.');
  }

  const { subscriptionId, plan, termsVersion } = body;
  const intake = intakeResult.data;

  try {
    // 2. El plan configurado es obligatorio (falla cerrado)
    assertPlanIdsConfigured();
    const expectedPlanId = PAYPAL_PLAN_IDS[plan as SubscriptionPlan];
    if (!expectedPlanId) {
      console.error('[PayPal] confirm-payment: plan_id no configurado para', plan);
      return fail(503, 'Servicio de pagos no disponible.');
    }

    // 3. Verificar la suscripción en PayPal: debe estar ACTIVE
    const paypalSub = await paypalFetch<PayPalSubscription>(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      'GET'
    );

    if (paypalSub.status !== 'ACTIVE') {
      return fail(422, 'La suscripción aún no está activa.');
    }
    if (paypalSub.plan_id !== expectedPlanId) {
      return fail(422, 'La suscripción no corresponde al plan seleccionado.');
    }

    // 4. Idempotencia: ¿ya existe un project con este subscriptionId?
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.paypalSubscriptionId, subscriptionId))
      .limit(1);

    if (existingProject) {
      return NextResponse.json({ projectId: existingProject.id });
    }

    // 5. Upsert Client
    const clientFields = {
      fullName: intake.fullName,
      email: intake.email,
      whatsapp: intake.whatsapp ?? null,
      businessName: intake.businessName,
      industry: intake.industry,
      location: intake.location ?? null,
      currentUrl: intake.currentUrl ?? null,
      materialStatus: intake.materialStatus,
    };

    let clientId: string;

    if (userId) {
      const [existingClient] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.clerkUserId, userId))
        .limit(1);

      if (existingClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(clients).set({
          ...clientFields,
          updatedAt: new Date(),
        }).where(eq(clients.clerkUserId, userId));

        clientId = existingClient.id;
      } else {
        const [newClient] = await db
          .insert(clients)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values({ clerkUserId: userId, ...clientFields })
          .returning({ id: clients.id });

        clientId = newClient.id;
      }
    } else {
      // Sin sesión: solo se puede reutilizar un cliente que todavía no tiene
      // usuario real (pending_*). Un cliente con cuenta verificada no puede
      // recibir proyectos de quien no ha iniciado sesión como ese usuario.
      const [existingByEmail] = await db
        .select({ id: clients.id, clerkUserId: clients.clerkUserId })
        .from(clients)
        .where(eq(clients.email, intake.email))
        .limit(1);

      if (existingByEmail) {
        if (!existingByEmail.clerkUserId?.startsWith(PENDING_PREFIX)) {
          return fail(409, 'Ya existe una cuenta con este correo. Inicia sesión para continuar.');
        }
        clientId = existingByEmail.id;
      } else {
        const [newClient] = await db
          .insert(clients)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .values({ clerkUserId: `${PENDING_PREFIX}${intake.email}`, ...clientFields })
          .returning({ id: clients.id });

        clientId = newClient.id;
      }
    }

    // 6. Crear Project en DB (la aceptación de términos usa la hora del servidor)
    const [newProject] = await db
      .insert(projects)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values({
        clientId,
        plan: plan as SubscriptionPlan,
        monthlyPriceCents: PLAN_MONTHLY_PRICE_CENTS[plan as SubscriptionPlan],
        setupFeeCents: SETUP_FEE_CENTS,
        paypalSubscriptionId: subscriptionId,
        status: 'PAYMENT_RECEIVED',
        termsAcceptedAt: new Date(),
        termsAcceptedIp: clientIpFrom(req),
        termsVersion,
        intakeSnapshot: intake as IntakeSnapshot,
        updatedAt: new Date(),
      })
      .returning({ id: projects.id });

    const projectId = newProject.id;

    // 7. Registrar evento en project_events
    await db.insert(projectEvents).values({
      projectId,
      eventType: 'payment_received',
      actorType: 'client',
      actorId: userId ?? clientId,
      toStatus: 'PAYMENT_RECEIVED',
    });

    // 8. Disparar Inngest
    await inngest.send({
      name: 'waas/payment.received',
      data: { projectId },
    });

    return NextResponse.json({ projectId });
  } catch (err) {
    console.error('[PayPal] Error en confirm-payment:', err);
    return fail(500, 'No se pudo confirmar el pago. Intenta de nuevo.');
  }
}
