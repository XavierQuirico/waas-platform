// ============================================================
// Admin - Tickets & Add-ons
// Server Component: Drizzle query
// ============================================================

import { db } from '@/db';
import { addonCatalog, clients, projects, tickets } from '@/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import TicketsPageClient, { type TicketAddonOption, type TicketRow, type TicketProjectOption } from './TicketsPageClient';
import {
  approveTicket,
  completeTicket,
  createTicket,
  rejectTicket,
  startWork,
  sendTicketQuote,
  recordTicketQuoteAcceptance,
  recordManualTicketPayment,
  reconcileTicketPayPalPayment,
} from './actions';

export default async function TicketsPage() {
  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      addonCatalogId: tickets.addonCatalogId,
      addonCode: addonCatalog.code,
      addonName: addonCatalog.name,
      addonType: tickets.addonType,
      title: tickets.title,
      description: tickets.description,
      priceAmount: tickets.priceAmount,
      priceCurrency: tickets.priceCurrency,
      billingDecision: tickets.billingDecision,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quotedPriceCents: tickets.quotedPriceCents,
      quoteScope: tickets.quoteScope,
      quoteEstimatedBusinessDays: tickets.quoteEstimatedBusinessDays,
      quoteExpiresAt: tickets.quoteExpiresAt,
      quoteAcceptanceSource: tickets.quoteAcceptanceSource,
      status: tickets.status,
      createdBy: tickets.createdBy,
      slaHours: tickets.slaHours,
      dueAt: tickets.dueAt,
      createdAt: tickets.createdAt,
      approvedAt: tickets.approvedAt,
      paymentRequestedAt: tickets.paymentRequestedAt,
      paidAt: tickets.paidAt,
      paidAmountCents: tickets.paidAmountCents,
      paidCurrency: tickets.paidCurrency,
      paymentMethod: tickets.paymentMethod,
      paymentReference: tickets.paymentReference,
      startedAt: tickets.startedAt,
      completedAt: tickets.completedAt,
      rejectedAt: tickets.rejectedAt,
      rejectionReason: tickets.rejectionReason,
      paypalOrderId: tickets.paypalOrderId,
      paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
      paypalOrderAmountCents: tickets.paypalOrderAmountCents,
      projectId: projects.id,
      plan: projects.plan,
      productionUrl: projects.productionUrl,
      domainTarget: projects.domainTarget,
      clientId: clients.id,
      clientName: clients.fullName,
      businessName: clients.businessName,
    })
    .from(tickets)
    .leftJoin(projects, eq(tickets.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(addonCatalog, eq(tickets.addonCatalogId, addonCatalog.id))
    .orderBy(desc(tickets.createdAt));

  const projectOptions = await db
    .select({
      id: projects.id,
      clientId: clients.id,
      plan: projects.plan,
      productionUrl: projects.productionUrl,
      domainTarget: projects.domainTarget,
      clientName: clients.fullName,
      businessName: clients.businessName,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.status, 'LIVE'))
    .orderBy(desc(projects.createdAt));

  const addonOptions = await db
    .select({
      id: addonCatalog.id,
      code: addonCatalog.code,
      name: addonCatalog.name,
      description: addonCatalog.description,
      priceCents: addonCatalog.priceCents,
      category: addonCatalog.category,
    })
    .from(addonCatalog)
    .where(eq(addonCatalog.active, true))
    .orderBy(asc(addonCatalog.category), asc(addonCatalog.code));

  const initialRows: TicketRow[] = rows.map((row) => ({
    ...row,
    addonCatalogId: row.addonCatalogId ?? null,
    addonCode: row.addonCode ?? null,
    addonName: row.addonName ?? null,
    description: row.description ?? '',
    priceCurrency: row.priceCurrency ?? 'USD',
    quoteRevision: row.quoteRevision ?? 0,
    quotedPriceCents: row.quotedPriceCents ?? null,
    quoteScope: row.quoteScope ?? null,
    quoteEstimatedBusinessDays: row.quoteEstimatedBusinessDays ?? null,
    quoteExpiresAt: row.quoteExpiresAt?.toISOString() ?? null,
    quoteAcceptanceSource: row.quoteAcceptanceSource ?? null,
    paidAmountCents: row.paidAmountCents ?? null,
    paidCurrency: row.paidCurrency ?? null,
    paymentMethod: row.paymentMethod ?? null,
    paymentReference: row.paymentReference ?? null,
    paypalOrderQuoteRevision: row.paypalOrderQuoteRevision ?? null,
    paypalOrderAmountCents: row.paypalOrderAmountCents ?? null,
    projectId: row.projectId ?? '',
    plan: row.plan ?? null,
    clientId: row.clientId ?? '',
    productionUrl: row.productionUrl ?? null,
    domainTarget: row.domainTarget ?? null,
    clientName: row.clientName ?? null,
    businessName: row.businessName ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    paymentRequestedAt: row.paymentRequestedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
  }));

  const projectsForForm: TicketProjectOption[] = projectOptions.map((project) => ({
    id: project.id,
    clientId: project.clientId ?? '',
    clientName: project.clientName ?? 'Cliente',
    businessName: project.businessName ?? 'Negocio',
    plan: project.plan,
    productionUrl: project.productionUrl,
    domainTarget: project.domainTarget,
    label: `${project.businessName ?? project.clientName ?? 'Cliente'} - ${project.plan}`,
  }));

  const addonsForForm: TicketAddonOption[] = addonOptions.map((addon) => ({
    id: addon.id,
    code: addon.code,
    name: addon.name,
    description: addon.description ?? '',
    priceCents: addon.priceCents,
    category: addon.category,
  }));

  return (
    <TicketsPageClient
      initialRows={initialRows}
      projects={projectsForForm}
      addons={addonsForForm}
      approveTicket={approveTicket}
      rejectTicket={rejectTicket}
      startWork={startWork}
      completeTicket={completeTicket}
      createTicket={createTicket}
      sendTicketQuote={sendTicketQuote}
      recordTicketQuoteAcceptance={recordTicketQuoteAcceptance}
      recordManualTicketPayment={recordManualTicketPayment}
      reconcileTicketPayPalPayment={reconcileTicketPayPalPayment}
    />
  );
}
