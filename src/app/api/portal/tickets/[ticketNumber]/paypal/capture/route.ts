// ============================================================
// POST /api/portal/tickets/[ticketNumber]/paypal/capture
// Captures an approved PayPal order and marks the ticket PAID.
// ============================================================

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, projects, tickets, ticketEvents, type NewTicketEvent } from '@/db/schema';
import { buildPayPalRequestId, paypalFetch } from '@/lib/paypal/client';
import { safeParsePayPalAmountCents } from '@/lib/tickets/billing';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type PayPalCaptureResponse = {
  id: string;
  status: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { value: string; currency_code: string };
      }>;
    };
  }>;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { ticketNumber } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const { orderId, expectedQuoteRevision } = body as {
    orderId?: unknown;
    expectedQuoteRevision?: unknown;
  };

  if (typeof orderId !== 'string' || !orderId.trim()) {
    return NextResponse.json({ error: 'orderId es obligatorio.' }, { status: 400 });
  }
  if (typeof expectedQuoteRevision !== 'number' || !Number.isInteger(expectedQuoteRevision)) {
    return NextResponse.json({ error: 'expectedQuoteRevision debe ser un entero.' }, { status: 400 });
  }

  try {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.clerkUserId, userId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 403 });
    }

    const [ticket] = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        projectId: tickets.projectId,
        status: tickets.status,
        quoteRevision: tickets.quoteRevision,
        paypalOrderId: tickets.paypalOrderId,
        paypalOrderAmountCents: tickets.paypalOrderAmountCents,
        paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
        paypalCaptureId: tickets.paypalCaptureId,
      })
      .from(tickets)
      .where(eq(tickets.ticketNumber, ticketNumber))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
    }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, ticket.projectId), eq(projects.clientId, client.id)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'No tienes acceso a este ticket.' }, { status: 403 });
    }

    // Early idempotency: ticket already PAID — only if orderId matches
    if (ticket.status === 'PAID') {
      if (ticket.paypalOrderId !== orderId) {
        return NextResponse.json(
          { error: 'El ticket ya fue pagado con una orden diferente.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Require PAYMENT_PENDING
    if (ticket.status !== 'PAYMENT_PENDING') {
      return NextResponse.json(
        { error: 'El ticket no está en estado válido para captura.' },
        { status: 409 },
      );
    }

    // Validate orderId matches
    if (ticket.paypalOrderId !== orderId) {
      return NextResponse.json(
        { error: 'El orderId no coincide con la orden activa de este ticket.' },
        { status: 409 },
      );
    }

    // Validate quoteRevision matches
    if (
      ticket.paypalOrderQuoteRevision !== null &&
      ticket.paypalOrderQuoteRevision !== expectedQuoteRevision
    ) {
      return NextResponse.json(
        { error: 'La revisión de cotización no coincide.' },
        { status: 409 },
      );
    }

    // Require stored amount
    if (!ticket.paypalOrderAmountCents || ticket.paypalOrderAmountCents <= 0) {
      return NextResponse.json(
        { error: 'El importe esperado no está registrado en el ticket.' },
        { status: 409 },
      );
    }

    const requestId = buildPayPalRequestId('capture', ticket.id, expectedQuoteRevision);

    let captureResponse: PayPalCaptureResponse;
    try {
      captureResponse = await paypalFetch<PayPalCaptureResponse>(
        `/v2/checkout/orders/${orderId}/capture`,
        'POST',
        {},
        { requestId },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al capturar pago.';
      console.error('[portal/paypal/capture] PayPal error:', message);
      return NextResponse.json(
        { ok: false, message: 'No pudimos confirmar tu pago. Tu aceptación sigue activa, inténtalo nuevamente.' },
        { status: 500 },
      );
    }

    // Require COMPLETED order status — return 502 so the client knows to retry
    if (captureResponse.status !== 'COMPLETED') {
      return NextResponse.json(
        { ok: false, message: 'No pudimos confirmar tu pago. Tu aceptación sigue activa, inténtalo nuevamente.' },
        { status: 502 },
      );
    }

    // Find COMPLETED capture
    const capture = captureResponse.purchase_units?.[0]?.payments?.captures?.find(
      (c) => c.status === 'COMPLETED',
    );

    if (!capture) {
      return NextResponse.json(
        { ok: false, message: 'No pudimos confirmar tu pago. Tu aceptación sigue activa, inténtalo nuevamente.' },
        { status: 502 },
      );
    }

    // Require capture amount
    if (!capture.amount?.value) {
      return NextResponse.json(
        { error: 'La captura no incluye importe. Contacta soporte.' },
        { status: 409 },
      );
    }

    // Require currency present and USD
    if (!capture.amount.currency_code || capture.amount.currency_code !== 'USD') {
      console.error('[portal/paypal/capture] Currency mismatch:', capture.amount.currency_code);
      return NextResponse.json(
        { error: 'La moneda de la captura no es USD.' },
        { status: 409 },
      );
    }

    // Safe decimal parse — no parseFloat
    const captureAmountCents = safeParsePayPalAmountCents(capture.amount.value);
    if (captureAmountCents === null) {
      console.error('[portal/paypal/capture] Cannot parse amount:', capture.amount.value);
      return NextResponse.json(
        { error: 'El importe de la captura no es válido.' },
        { status: 409 },
      );
    }

    // Validate amount matches expected
    if (captureAmountCents !== ticket.paypalOrderAmountCents) {
      console.error(
        `[portal/paypal/capture] Amount mismatch: expected ${ticket.paypalOrderAmountCents}, got ${captureAmountCents}`,
      );
      return NextResponse.json(
        { error: 'El importe capturado no coincide con el esperado.' },
        { status: 409 },
      );
    }

    const now = new Date();

    // Atomic: update ticket only if still PAYMENT_PENDING
    const [updateResult] = await db
      .update(tickets)
      .set({
        status: 'PAID',
        paypalCaptureId: capture.id,
        paidAt: now,
        paidAmountCents: captureAmountCents,
        paidCurrency: 'USD',
        paymentMethod: 'paypal_checkout',
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticket.id), eq(tickets.status, 'PAYMENT_PENDING')))
      .returning({ id: tickets.id });

    if (!updateResult) {
      // Possible race: re-fetch to check idempotency
      const [fresh] = await db
        .select({ status: tickets.status, paypalCaptureId: tickets.paypalCaptureId })
        .from(tickets)
        .where(eq(tickets.id, ticket.id))
        .limit(1);

      if (fresh?.status === 'PAID' && fresh.paypalCaptureId === capture.id) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json(
        { error: 'Conflicto: el ticket ya fue procesado.' },
        { status: 409 },
      );
    }

    // Event only inserted if update succeeded
    const captureEvent: NewTicketEvent = {
      ticketId: ticket.id,
      eventType: 'PAYPAL_CAPTURE_COMPLETED',
      previousStatus: 'PAYMENT_PENDING',
      newStatus: 'PAID',
      actorId: userId,
      actorRole: 'client',
      quoteRevision: expectedQuoteRevision,
      amountCents: captureAmountCents,
      currency: 'USD',
      visibility: 'public',
      metadata: {
        paypalOrderId: orderId,
        captureId: capture.id,
      },
    };
    await db.insert(ticketEvents).values(captureEvent);

    revalidatePath('/cambios-y-mejoras');
    revalidatePath(`/cambios-y-mejoras/${ticket.ticketNumber}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno.';
    console.error('[portal/paypal/capture]', message);
    return NextResponse.json(
      { ok: false, message: 'No pudimos confirmar tu pago. Tu aceptación sigue activa, inténtalo nuevamente.' },
      { status: 500 },
    );
  }
}
