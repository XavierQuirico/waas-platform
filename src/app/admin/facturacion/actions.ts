'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { adminHref, getHostContext } from '@/lib/routing/host-context';
import { db } from '@/db';
import { clients } from '@/db/schema/clients';
import { maintenanceContracts } from '@/db/schema/maintenance-contracts';
import { projects } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { quotes } from '@/db/schema/quotes';
import { ticketEvents, tickets } from '@/db/schema/tickets';
import { inngest } from '@/inngest/client';
import { isIncludedBillingDecision } from '@/lib/tickets/billing';
import type { CatalogDecisionCode } from '@/lib/catalog/types';
import { requireAdmin } from '@/lib/admin/auth';

type ManualPaymentLineType = 'setup_fee' | 'subscription' | 'maintenance' | 'ticket_addon' | 'legacy';

type ManualPaymentLine = {
  type: ManualPaymentLineType;
  sourceId: string | null;
  label: string;
  amountCents: number;
};

const VALID_LINE_TYPES = ['setup_fee', 'subscription', 'maintenance', 'ticket_addon', 'legacy'];
const ACTIVE_STATUSES = ['LIVE', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'PRODUCTION_STARTED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW', 'PAYMENT_RECEIVED'];
const BILLABLE_STATUSES = ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED', ...ACTIVE_STATUSES, 'SUSPENDED'];

function parseLineItems(raw: FormDataEntryValue | null): ManualPaymentLine[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const type = typeof source.type === 'string' ? source.type : '';
      const label = typeof source.label === 'string' ? source.label.trim() : '';
      const sourceId = typeof source.sourceId === 'string' ? source.sourceId : null;
      const amountCents = typeof source.amountCents === 'number' ? Math.round(source.amountCents) : 0;
      if (!VALID_LINE_TYPES.includes(type) || !label || !Number.isFinite(amountCents) || amountCents <= 0) {
        return null;
      }
      return { type: type as ManualPaymentLineType, sourceId, label, amountCents };
    })
    .filter((item): item is ManualPaymentLine => Boolean(item));
}

export async function getManualPaymentOptions() {
  await requireAdmin();
  const [allClients, allProjects, allQuotes, allMaintenanceContracts, allTickets] = await Promise.all([
    db.select().from(clients),
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        plan: projects.plan,
        monthlyPriceCents: projects.monthlyPriceCents,
        setupFeeCents: projects.setupFeeCents,
        status: projects.status,
      })
      .from(projects),
    db.select().from(quotes),
    db.select().from(maintenanceContracts),
    db.select().from(tickets),
  ]);

  const clientById = new Map(allClients.map((client) => [client.id, client]));
  const projectsOptions = allProjects
    .filter((project) => BILLABLE_STATUSES.includes(project.status))
    .map((project) => {
      const client = clientById.get(project.clientId);
      return {
        id: project.id,
        clientId: project.clientId,
        clientName: client?.fullName ?? 'Cliente',
        businessName: client?.businessName ?? 'Negocio',
        plan: project.plan,
        status: project.status,
        monthlyPriceCents: project.monthlyPriceCents,
        setupFeeCents: project.setupFeeCents,
      };
    });

  return {
    projects: projectsOptions,
    quotes: allQuotes
      .filter((quote) => quote.status !== 'rejected' && quote.status !== 'expired')
      .map((quote) => ({
        id: quote.id,
        clientName: quote.clientName,
        businessName: quote.businessName,
        status: quote.status,
        projectType: quote.projectType,
        amountCents: Math.round(quote.totalAmountProvider * 100),
        plan: quote.subscriptionPlan,
      })),
    maintenanceContracts: allMaintenanceContracts
      .filter((contract) => contract.status === 'active' || contract.status === 'paused')
      .map((contract) => ({
        id: contract.id,
        clientId: contract.clientId,
        projectId: contract.projectId,
        tier: contract.tier,
        amountCents: contract.monthlyPriceCents + (contract.hostingIncluded ? contract.hostingPriceCents : 0),
        status: contract.status,
      })),
    tickets: allTickets
      .filter((ticket) => (
        (ticket.status === 'APPROVED' || ticket.status === 'PAYMENT_PENDING')
        && ticket.priceAmount > 0
        && (ticket.quoteStatus === 'none' || ticket.quoteStatus === 'accepted')
        && !isIncludedBillingDecision(ticket.billingDecision as CatalogDecisionCode | null)
      ))
      .map((ticket) => ({
        id: ticket.id,
        projectId: ticket.projectId,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        amountCents: ticket.priceAmount,
        status: ticket.status,
        addonName: null,
      })),
  };
}

export async function registerManualPayment(formData: FormData) {
  await requireAdmin();
  const projectId = String(formData.get('projectId') ?? '');
  const paidAtRaw = String(formData.get('paidAt') ?? '');
  const linkedQuoteId = String(formData.get('linkedQuoteId') ?? '').trim();
  const lineItems = parseLineItems(formData.get('lineItems'));
  const totalCents = lineItems.reduce((sum, line) => sum + line.amountCents, 0);
  const total = totalCents / 100;

  if (!projectId || lineItems.length === 0 || !Number.isFinite(total) || total <= 0) {
    throw new Error('Datos de pago manual invalidos.');
  }
  if (lineItems.some((line) => line.type === 'ticket_addon' && !line.sourceId)) {
    throw new Error('Selecciona el ticket/add-on que estas cobrando.');
  }

  const [project] = await db
    .select({ id: projects.id, status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const lineTypes = lineItems.map((line) => line.type);
  const shouldStartOnboarding = lineTypes.includes('setup_fee') && ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED'].includes(project.status);
  const shouldReactivate = lineTypes.includes('subscription') && project.status === 'SUSPENDED';
  const nextStatus = shouldStartOnboarding ? 'PAYMENT_RECEIVED' : shouldReactivate ? 'LIVE' : null;

  await db.insert(projectEvents).values({
    projectId,
    eventType: 'payment_received',
    actorType: 'admin',
    actorId: 'admin',
    fromStatus: nextStatus ? project.status : null,
    toStatus: nextStatus,
    metadata: {
      source: 'manual',
      paymentType: lineTypes.join('+'),
      grossAmount: total,
      netAmount: total,
      totalAmount: total,
      totalAmountCents: totalCents,
      linkedQuoteId: linkedQuoteId || null,
      lineItems,
      method: String(formData.get('method') ?? 'Manual'),
      reference: String(formData.get('reference') ?? ''),
      paidAt: paidAtRaw,
      notes: String(formData.get('notes') ?? ''),
    },
    createdAt: paidAtRaw ? new Date(paidAtRaw) : new Date(),
  });

  if (nextStatus) {
    const now = new Date();
    const extraFields = shouldReactivate
      ? { suspendedAt: null, paymentGracePeriodUntil: null, reactivationFeeActive: false }
      : {};
    await db
      .update(projects)
      .set({ status: nextStatus, ...extraFields, updatedAt: now })
      .where(eq(projects.id, projectId));
  }

  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
  for (const line of lineItems.filter((item) => item.type === 'ticket_addon' && item.sourceId)) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        quoteStatus: tickets.quoteStatus,
        priceAmount: tickets.priceAmount,
        billingDecision: tickets.billingDecision,
      })
      .from(tickets)
      .where(eq(tickets.id, line.sourceId!))
      .limit(1);

    if (!ticket || ticket.status === 'PAID') continue;
    if (ticket.priceAmount <= 0 || isIncludedBillingDecision(ticket.billingDecision as CatalogDecisionCode | null)) {
      throw new Error('Los tickets incluidos o de $0 no pueden registrarse como pago.');
    }
    if (ticket.quoteStatus !== 'none' && ticket.quoteStatus !== 'accepted') {
      throw new Error('La cotizacion debe estar aceptada antes de registrar pago.');
    }

    await db
      .update(tickets)
      .set({ status: 'PAID', paidAt, updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id));

    await db.insert(ticketEvents).values({
      ticketId: ticket.id,
      eventType: 'STATUS_CHANGED',
      previousStatus: ticket.status,
      newStatus: 'PAID',
      actorId: 'ADMIN',
      actorRole: 'admin',
      note: 'Pago manual registrado desde Facturacion.',
      metadata: {
        source: 'manual_payment',
        projectId,
        amountCents: line.amountCents,
        reference: String(formData.get('reference') ?? ''),
      },
      createdAt: paidAt,
    });
  }

  if (shouldStartOnboarding) {
    await inngest.send({
      name: 'waas/payment.received',
      data: { projectId },
    });
  }

  revalidatePath('/admin/facturacion');
  revalidatePath('/admin/insights');
  revalidatePath('/admin/proyectos');
  revalidatePath('/admin/sitios');
  revalidatePath('/admin/tickets');

  const hdrs = await headers();
  const hostCtx = getHostContext(hdrs.get('host') ?? '');
  redirect(adminHref('/admin/facturacion', hostCtx));
}
