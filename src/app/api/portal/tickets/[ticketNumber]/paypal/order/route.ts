// ============================================================
// POST /api/portal/tickets/[ticketNumber]/paypal/order
// Creates a PayPal order for an accepted quote.
// ============================================================

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, projects, tickets, ticketEvents, type NewTicketEvent } from '@/db/schema';
import { buildPayPalRequestId, paypalFetch } from '@/lib/paypal/client';
import {
  canRequestTicketPayment,
  centsToPayPalAmount,
  type TicketStatus,
  type TicketQuoteStatus,
} from '@/lib/tickets/billing';
import type { CatalogDecisionCode } from '@/lib/catalog/types';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type PayPalOrderResponse = {
  id: string;
  links?: Array<{ href: string; rel: string; method?: string }>;
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

  const { expectedQuoteRevision } = body as { expectedQuoteRevision?: unknown };
  if (typeof expectedQuoteRevision !== 'number' || !Number.isInteger(expectedQuoteRevision)) {
    return NextResponse.json({ error: 'expectedQuoteRevision debe ser un entero.' }, { status: 400 });
  }

  try {
    // Load client by clerkUserId
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.clerkUserId, userId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 403 });
    }

    // Load ticket by ticketNumber
    const [ticket] = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        projectId: tickets.projectId,
        status: tickets.status,
        quoteStatus: tickets.quoteStatus,
        quoteRevision: tickets.quoteRevision,
        quotedPriceCents: tickets.quotedPriceCents,
        priceAmount: tickets.priceAmount,
        billingDecision: tickets.billingDecision,
        paypalOrderId: tickets.paypalOrderId,
        paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
        paypalOrderAmountCents: tickets.paypalOrderAmountCents,
        quoteExpiresAt: tickets.quoteExpiresAt,
      })
      .from(tickets)
      .where(eq(tickets.ticketNumber, ticketNumber))
      .limit(1);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
    }

    // Verify ticket belongs to this client's project
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, ticket.projectId), eq(projects.clientId, client.id)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'No tienes acceso a este ticket.' }, { status: 403 });
    }

    const now = new Date();
    const paymentCheck = canRequestTicketPayment(
      {
        status: ticket.status as TicketStatus,
        quoteStatus: ticket.quoteStatus as TicketQuoteStatus,
        quoteRevision: ticket.quoteRevision,
        quotedPriceCents: ticket.quotedPriceCents,
        priceAmount: ticket.priceAmount,
        billingDecision: ticket.billingDecision as CatalogDecisionCode | null,
        paypalOrderId: ticket.paypalOrderId,
        paypalOrderQuoteRevision: ticket.paypalOrderQuoteRevision,
        quoteExpiresAt: ticket.quoteExpiresAt ?? null,
      },
      expectedQuoteRevision,
      now,
    );

    // Idempotent: already pending for same revision
    if (paymentCheck.alreadyPending) {
      return NextResponse.json({ orderId: ticket.paypalOrderId });
    }

    const priceCents = ticket.quotedPriceCents ?? ticket.priceAmount;
    const requestId = buildPayPalRequestId('order', ticket.id, expectedQuoteRevision);

    const order = await paypalFetch<PayPalOrderResponse>(
      '/v2/checkout/orders',
      'POST',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: centsToPayPalAmount(priceCents),
            },
            custom_id: ticket.id,
            invoice_id: `${ticket.ticketNumber}-r${expectedQuoteRevision}`,
            description: 'Cambio para tu sitio web',
          },
        ],
      },
      { requestId },
    );

    // Update ticket with PayPal order (conditional on revision to prevent races)
    const updated = await db
      .update(tickets)
      .set({
        status: 'PAYMENT_PENDING' as TicketStatus,
        paypalOrderId: order.id,
        paypalOrderQuoteRevision: expectedQuoteRevision,
        paypalOrderAmountCents: priceCents,
        paymentRequestedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(tickets.id, ticket.id),
          eq(tickets.quoteRevision, expectedQuoteRevision),
          eq(tickets.status, 'APPROVED'),
        ),
      )
      .returning({ id: tickets.id });

    if (updated.length === 0) {
      throw new Error('Conflicto: el estado del ticket cambió. Recarga e intenta de nuevo.');
    }

    const orderEvent: NewTicketEvent = {
      ticketId: ticket.id,
      eventType: 'PAYPAL_ORDER_CREATED',
      previousStatus: ticket.status as TicketStatus,
      newStatus: 'PAYMENT_PENDING',
      actorId: userId,
      actorRole: 'client',
      quoteRevision: expectedQuoteRevision,
      visibility: 'public',
      metadata: { paypalOrderId: order.id },
    };
    await db.insert(ticketEvents).values(orderEvent);

    revalidatePath('/cambios-y-mejoras');
    revalidatePath(`/cambios-y-mejoras/${ticket.ticketNumber}`);

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno.';
    console.error('[portal/paypal/order]', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
