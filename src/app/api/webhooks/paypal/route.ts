// PayPal Webhook Handler — WaaS
// Eventos: PAYMENT.CAPTURE.COMPLETED, BILLING.SUBSCRIPTION.*, PAYMENT.SALE.COMPLETED
// Seguridad: firma verificada con OAuth Bearer (no Basic auth), sandbox/producción correctos.
// Idempotencia: on conflict do nothing + verifica processedAt.
// Lookup de tickets: por paypalOrderId, no por custom_id UUID.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, ticketEvents, tickets, webhookEvents } from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { getPayPalAccessToken, PAYPAL_BASE } from '@/lib/paypal/client';
import { safeParsePayPalAmountCents } from '@/lib/tickets/billing';
import {
  isRecurringPaymentSuccessEvent,
  extractPayPalSubscriptionId,
  buildPaymentSuccessGraceClearFields,
} from '@/lib/projects/payment-lifecycle';

// Estados previos al pago, desde los que un cobro confirmado inicia el onboarding.
const PRE_PAYMENT_STATUSES = ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED'] as const;

// ─── Verificación de firma ────────────────────────────────
async function verifyPayPalWebhookSignature(req: NextRequest, body: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[PayPal Webhook] PAYPAL_WEBHOOK_ID no configurado — rechazando en producción');
      return false;
    }
    // Solo en desarrollo sin ID configurado
    console.warn('[PayPal Webhook] PAYPAL_WEBHOOK_ID ausente — saltando verificación en desarrollo');
    return true;
  }

  const transmissionId = req.headers.get('paypal-transmission-id');
  const timestamp = req.headers.get('paypal-transmission-time');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');
  const transmissionSig = req.headers.get('paypal-transmission-sig');

  if (!transmissionId || !timestamp || !certUrl || !authAlgo || !transmissionSig) {
    console.error('[PayPal Webhook] Headers de firma incompletos');
    return false;
  }

  try {
    // Usa PAYPAL_BASE (sandbox vs producción) y OAuth Bearer — no Basic auth
    const token = await getPayPalAccessToken();
    const verifyRes = await fetch(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: timestamp,
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!verifyRes.ok) {
      console.error(`[PayPal Webhook] Verificación de firma HTTP ${verifyRes.status}`);
      return false;
    }

    const result = (await verifyRes.json()) as { verification_status?: string };
    return result.verification_status === 'SUCCESS';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[PayPal Webhook] Error verificando firma: ${msg}`);
    return false;
  }
}

// ─── Inserción idempotente de webhook event ───────────────
// Devuelve true si el evento es nuevo y debe procesarse.
// Devuelve false si ya fue procesado exitosamente (skip).
async function insertWebhookEventIfNew(
  paypalEventId: string,
  eventType: string,
  rawPayload: unknown,
): Promise<{ isNew: boolean; alreadyProcessed: boolean }> {
  if (!paypalEventId) return { isNew: true, alreadyProcessed: false };

  try {
    // on conflict do nothing — no trata cualquier error como duplicado
    await db.insert(webhookEvents).values({
      paypalEventId,
      eventType,
      rawPayload: rawPayload as Record<string, unknown>,
      processingAttempts: 1,
      processingStartedAt: new Date(),
      lastAttemptAt: new Date(),
    }).onConflictDoNothing();
  } catch (e) {
    // Error real de DB distinto a unicidad — propagar
    throw e;
  }

  // Consultar si existe y si ya fue procesado
  const [existing] = await db
    .select({ processedAt: webhookEvents.processedAt })
    .from(webhookEvents)
    .where(eq(webhookEvents.paypalEventId, paypalEventId))
    .limit(1);

  if (!existing) {
    // La inserción lo creó; el registro existe ahora
    return { isNew: true, alreadyProcessed: false };
  }

  if (existing.processedAt !== null) {
    return { isNew: false, alreadyProcessed: true };
  }

  // Existe pero no procesado — puede ser reintento
  return { isNew: false, alreadyProcessed: false };
}

async function markWebhookProcessed(paypalEventId: string) {
  if (!paypalEventId) return;
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date(), lastError: null })
    .where(eq(webhookEvents.paypalEventId, paypalEventId));
}

async function markWebhookError(paypalEventId: string, error: string) {
  if (!paypalEventId) return;
  const sanitizedError = error.replace(/Bearer [^\s]+/g, 'Bearer [redacted]').slice(0, 500);
  await db
    .update(webhookEvents)
    .set({
      lastError: sanitizedError,
      lastAttemptAt: new Date(),
      processingAttempts: sql`processing_attempts + 1`,
    })
    .where(eq(webhookEvents.paypalEventId, paypalEventId));
}

// ─── Handler principal ────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.text();

  const isValid = await verifyPayPalWebhookSignature(req, body);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = (event.event_type as string | undefined) ?? '';
  const resource = (event.resource as Record<string, unknown> | undefined) ?? {};
  const paypalEventId = (event.id as string | undefined) ?? '';

  // ─── Idempotencia ─────────────────────────────────────
  const { alreadyProcessed } = await insertWebhookEventIfNew(paypalEventId, eventType, event);
  if (alreadyProcessed) {
    console.info(`[PayPal Webhook] Evento ya procesado: ${paypalEventId} — skip`);
    return NextResponse.json({ received: true });
  }

  try {
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await handleCaptureCompleted(resource, paypalEventId);
    } else if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      await handleSubscriptionActivated(resource);
    } else if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      await handleSubscriptionPaymentFailed(resource);
    } else if (isRecurringPaymentSuccessEvent(eventType)) {
      await handleRecurringPaymentSuccess(eventType, resource);
    } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
      await handleSubscriptionCancelled(resource);
    }
    // Eventos de captura denegada/reembolso/disputa: registrar y alertar sin degradar estado
    // Implementación de autoservicio de reembolsos excluida de este bloque

    await markWebhookProcessed(paypalEventId);
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[PayPal Webhook] Error procesando ${eventType}: ${msg}`);
    await markWebhookError(paypalEventId, msg);
    // Devuelve 500 para que PayPal reintente
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

// ─── Handlers por tipo de evento ─────────────────────────

async function handleCaptureCompleted(
  resource: Record<string, unknown>,
  paypalEventId: string,
) {
  // Extrae order_id desde supplementary_data — NO usar resource.id como fallback.
  // resource.id es el captureId; confundirlo con orderId causaría lookup incorrecto.
  const supplementary = resource.supplementary_data as Record<string, unknown> | undefined;
  const relatedIds = supplementary?.related_ids as Record<string, unknown> | undefined;
  const orderId = relatedIds?.order_id as string | undefined;
  const captureId = resource.id as string | undefined;

  if (!orderId) {
    // Sin order_id no podemos vincular al ticket ni al proyecto correctamente.
    // Lanzar error fuerza retry de PayPal en lugar de marcar procesado incorrectamente.
    throw new Error(
      `PAYMENT.CAPTURE.COMPLETED sin supplementary_data.related_ids.order_id. ` +
      `paypalEventId: ${paypalEventId}. captureId: ${captureId ?? 'unknown'}`,
    );
  }

  // Busca el ticket por paypalOrderId
  {
    const [ticket] = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        status: tickets.status,
        quoteStatus: tickets.quoteStatus,
        quoteRevision: tickets.quoteRevision,
        paypalOrderId: tickets.paypalOrderId,
        paypalOrderAmountCents: tickets.paypalOrderAmountCents,
        paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
        paidAt: tickets.paidAt,
        paypalCaptureId: tickets.paypalCaptureId,
      })
      .from(tickets)
      .where(eq(tickets.paypalOrderId, orderId))
      .limit(1);

    if (ticket) {
      // Idempotencia: si ya está pagado con este capture ID, devolver ok
      if (ticket.status === 'PAID' && ticket.paypalCaptureId === captureId) {
        await markWebhookProcessed(paypalEventId);
        return;
      }

      if (ticket.status === 'PAID') {
        // Pagado con capture distinto — discrepancia crítica; lanzar error para que PayPal reintente
        if (ticket.paypalCaptureId !== captureId) {
          throw new Error(
            `Ticket ${ticket.ticketNumber} ya pagado con captureId diferente. captureId recibido: ${captureId}, existente: ${ticket.paypalCaptureId}`,
          );
        }
        // Mismo captureId — idempotencia OK, ya procesado
        return;
      }

      // FIX P0: validar importe y moneda antes de marcar pagado
      const captureStatus = (resource.status as string | undefined) ?? '';
      if (captureStatus !== 'COMPLETED') {
        throw new Error(`Captura no completada (${captureStatus}) para ticket ${ticket.ticketNumber}`);
      }

      const amount = resource.amount as Record<string, unknown> | undefined;
      const captureAmountStr = (amount?.value as string | undefined) ?? '';
      const captureCurrency = (amount?.currency_code as string | undefined) ?? '';

      if (!captureAmountStr) {
        throw new Error(`Importe de captura ausente para ticket ${ticket.ticketNumber}`);
      }

      const captureAmountCents = safeParsePayPalAmountCents(captureAmountStr);
      if (captureAmountCents === null) {
        throw new Error(`Importe de captura inválido "${captureAmountStr}" para ticket ${ticket.ticketNumber}`);
      }

      const expectedCents = ticket.paypalOrderAmountCents ?? 0;
      if (expectedCents > 0 && captureAmountCents !== expectedCents) {
        throw new Error(
          `Importe incorrecto para ticket ${ticket.ticketNumber}: ` +
          `esperado ${expectedCents}¢, recibido ${captureAmountCents}¢`,
        );
      }

      if (captureCurrency && captureCurrency !== 'USD') {
        throw new Error(
          `Moneda incorrecta para ticket ${ticket.ticketNumber}: ${captureCurrency}`,
        );
      }

      const now = new Date();
      const finalCents = captureAmountCents > 0 ? captureAmountCents : expectedCents;

      // Conditional update: only if still PAYMENT_PENDING and same orderId
      const [updated] = await db
        .update(tickets)
        .set({
          status: 'PAID',
          paypalCaptureId: captureId ?? null,
          paidAt: now,
          paidAmountCents: finalCents,
          paidCurrency: 'USD',
          paymentMethod: 'paypal_checkout',
          updatedAt: now,
        })
        .where(and(
          eq(tickets.id, ticket.id),
          eq(tickets.status, 'PAYMENT_PENDING'),
          eq(tickets.paypalOrderId, orderId),
        ))
        .returning({ id: tickets.id });

      if (!updated) {
        throw new Error(
          `Ticket ${ticket.ticketNumber} ya no está en PAYMENT_PENDING o el orderId cambió; se descarta capture.`,
        );
      }

      await db.insert(ticketEvents).values({
        ticketId: ticket.id,
        eventType: 'PAYPAL_CAPTURE_COMPLETED',
        previousStatus: ticket.status,
        newStatus: 'PAID',
        actorId: 'PAYPAL',
        actorRole: 'system',
        quoteRevision: ticket.paypalOrderQuoteRevision ?? ticket.quoteRevision,
        amountCents: finalCents,
        currency: 'USD',
        paymentMethod: 'paypal_checkout',
        visibility: 'public',
        metadata: {
          paypalOrderId: orderId,
          paypalCaptureId: captureId,
          paypalEventId,
        },
      });

      return;
    }
  }

  // No corresponde a un ticket — flujo setup fee / proyecto
  const customId = (
    (resource as Record<string, unknown>).custom_id as string | undefined
  ) ?? (
    ((resource.purchase_units as Array<Record<string, unknown>> | undefined)?.[0]?.custom_id) as string | undefined
  );

  if (customId) {
    // Solo un proyecto que aún no ha pagado pasa a PAYMENT_RECEIVED. Un evento
    // repetido, fuera de orden o con un custom_id ajeno no debe degradar un
    // proyecto que ya está en producción o publicado.
    const updated = await db
      .update(projects)
      .set({
        paypalOrderId: orderId ?? null,
        status: 'PAYMENT_RECEIVED' as const,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, customId), inArray(projects.status, PRE_PAYMENT_STATUSES)))
      .returning({ id: projects.id });

    if (updated.length > 0) {
      // `id` hace idempotente el envío: PayPal puede reenviar el evento.
      await inngest.send({
        id: `payment-received-${customId}`,
        name: 'waas/payment.received',
        data: { projectId: customId },
      });
    }
  }
}

async function handleSubscriptionActivated(resource: Record<string, unknown>) {
  const subscriptionId = resource.id as string | undefined;
  const customId = resource.custom_id as string | undefined;

  if (customId && subscriptionId) {
    // Solo se asigna si el proyecto aún no tiene una suscripción: no se pisa una existente.
    await db
      .update(projects)
      .set({ paypalSubscriptionId: subscriptionId, updatedAt: new Date() })
      .where(and(eq(projects.id, customId), isNull(projects.paypalSubscriptionId)));
  }
}

async function handleSubscriptionPaymentFailed(resource: Record<string, unknown>) {
  const subscriptionId = resource.id as string | undefined;
  if (!subscriptionId) return;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (project) {
    await inngest.send({ name: 'waas/payment.failed', data: { projectId: project.id } });
  }
}

async function handleRecurringPaymentSuccess(
  eventType: string,
  resource: Record<string, unknown>,
) {
  const subscriptionId = extractPayPalSubscriptionId(eventType, resource);
  if (!subscriptionId) return;

  const [project] = await db
    .select({ id: projects.id, paymentGracePeriodUntil: projects.paymentGracePeriodUntil })
    .from(projects)
    .where(eq(projects.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (project?.paymentGracePeriodUntil) {
    await db
      .update(projects)
      .set(buildPaymentSuccessGraceClearFields(new Date()))
      .where(eq(projects.id, project.id));
  }
}

async function handleSubscriptionCancelled(resource: Record<string, unknown>) {
  const subscriptionId = resource.id as string | undefined;
  if (!subscriptionId) return;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.paypalSubscriptionId, subscriptionId))
    .limit(1);

  if (project) {
    await inngest.send({
      name: 'waas/subscription.cancelled',
      data: { projectId: project.id, subscriptionId },
    });
  }
}
