'use server';

import { db } from '@/db';
import {
  addonCatalog,
  projects,
  ticketEvents,
  tickets,
  type NewTicketEvent,
} from '@/db/schema';
import { requirePortalClient } from '@/lib/portal/context';
import { and, eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  interpretChangeRequest,
  type ChangeInterpretationResult,
} from '@/lib/tickets/interpretChangeRequest';
import {
  deriveClientTicketStatus,
  CLIENT_STATUS_LABELS,
  type TicketStatus,
  type TicketQuoteStatus,
} from '@/lib/tickets/billing';
import type { ClientTicketStatus } from '@/lib/tickets/billing';
import type { CatalogDecisionCode } from '@/lib/catalog/types';

export interface ClientProject {
  id: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  status: string;
  productionUrl: string | null;
  stagingUrl: string | null;
  liveAt: Date | null;
  portfolioFlag: boolean;
}

export interface HubTicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  addonPublicName: string | null;
  createdAt: Date;
  clientStatus: ClientTicketStatus;
  clientStatusLabel: string;
  priceAmount: number;
  quoteStatus: string;
}

export interface HubData {
  projects: ClientProject[];
  selectedProject: ClientProject | null;
  tickets: HubTicketRow[];
}

export async function getHubData(selectedProjectId?: string): Promise<HubData> {
  const ctx = await requirePortalClient();

  const allProjects = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      status: projects.status,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
      liveAt: projects.liveAt,
      portfolioFlag: projects.portfolioFlag,
      clientId: projects.clientId,
    })
    .from(projects)
    .where(eq(projects.clientId, ctx.client.id))
    .orderBy(desc(projects.createdAt));

  const clientProjects: ClientProject[] = allProjects.map((p) => ({
    id: p.id,
    plan: p.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
    status: p.status,
    productionUrl: p.productionUrl ?? null,
    stagingUrl: p.stagingUrl ?? null,
    liveAt: p.liveAt ?? null,
    portfolioFlag: p.portfolioFlag,
  }));

  if (clientProjects.length === 0) {
    return { projects: [], selectedProject: null, tickets: [] };
  }

  // Selección de proyecto: explícita (validada contra propiedad) o primer LIVE, o primero
  let selected: ClientProject | null = null;
  if (selectedProjectId) {
    selected = clientProjects.find((p) => p.id === selectedProjectId) ?? null;
  }
  if (!selected) {
    selected = clientProjects.find((p) => p.status === 'LIVE') ?? clientProjects[0];
  }

  if (!selected) return { projects: clientProjects, selectedProject: null, tickets: [] };

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      status: tickets.status,
      billingDecision: tickets.billingDecision,
      quoteStatus: tickets.quoteStatus,
      priceAmount: tickets.priceAmount,
      quoteExpiresAt: tickets.quoteExpiresAt,
      createdAt: tickets.createdAt,
      addonPublicName: addonCatalog.publicName,
    })
    .from(tickets)
    .leftJoin(addonCatalog, eq(tickets.addonCatalogId, addonCatalog.id))
    .where(eq(tickets.projectId, selected.id))
    .orderBy(desc(tickets.createdAt));

  const now = new Date();
  const ticketRows: HubTicketRow[] = rows.map((row) => {
    const clientStatus = deriveClientTicketStatus(
      row.status as TicketStatus,
      row.billingDecision as CatalogDecisionCode | null,
      row.quoteStatus as TicketQuoteStatus,
      { quoteExpiresAt: row.quoteExpiresAt, now },
    );
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      title: row.title,
      addonPublicName: row.addonPublicName ?? null,
      createdAt: row.createdAt,
      clientStatus,
      clientStatusLabel: CLIENT_STATUS_LABELS[clientStatus] ?? clientStatus,
      priceAmount: row.priceAmount,
      quoteStatus: row.quoteStatus,
    };
  });

  return { projects: clientProjects, selectedProject: selected, tickets: ticketRows };
}

export interface TicketDetailData {
  id: string;
  ticketNumber: string;
  title: string;
  description: string | null;
  addonPublicName: string | null;
  clientStatus: ClientTicketStatus;
  clientStatusLabel: string;
  quoteStatus: string;
  quoteRevision: number;
  quotedPriceCents: number | null;
  quoteScope: string | null;
  quoteEstimatedBusinessDays: number | null;
  quoteExpiresAt: Date | null;
  paypalOrderId: string | null;
  paypalOrderQuoteRevision: number | null;
  paidAt: Date | null;
  paidAmountCents: number | null;
  paidCurrency: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  projectId: string;
  projectProductionUrl: string | null;
  events: PublicTicketEvent[];
}

export interface PublicTicketEvent {
  id: string;
  eventType: string;
  createdAt: Date;
  note: string | null;
  amountCents: number | null;
  currency: string | null;
  actorRole: string;
}

export async function getTicketDetail(ticketNumber: string): Promise<TicketDetailData | null> {
  const ctx = await requirePortalClient();

  // Buscar ticket por ticketNumber y verificar propiedad vía join con projects + clientId
  const [row] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      billingDecision: tickets.billingDecision,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quotedPriceCents: tickets.quotedPriceCents,
      quoteScope: tickets.quoteScope,
      quoteEstimatedBusinessDays: tickets.quoteEstimatedBusinessDays,
      quoteExpiresAt: tickets.quoteExpiresAt,
      paypalOrderId: tickets.paypalOrderId,
      paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
      paidAt: tickets.paidAt,
      paidAmountCents: tickets.paidAmountCents,
      paidCurrency: tickets.paidCurrency,
      paymentMethod: tickets.paymentMethod,
      createdAt: tickets.createdAt,
      projectId: tickets.projectId,
      projectClientId: projects.clientId,
      productionUrl: projects.productionUrl,
      addonPublicName: addonCatalog.publicName,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .leftJoin(addonCatalog, eq(tickets.addonCatalogId, addonCatalog.id))
    .where(
      and(
        eq(tickets.ticketNumber, ticketNumber),
        eq(projects.clientId, ctx.client.id),
      ),
    )
    .limit(1);

  if (!row) return null;

  const now = new Date();
  const clientStatus = deriveClientTicketStatus(
    row.status as TicketStatus,
    row.billingDecision as CatalogDecisionCode | null,
    row.quoteStatus as TicketQuoteStatus,
    { quoteExpiresAt: row.quoteExpiresAt, now },
  );

  // Solo eventos públicos — nunca exponer eventos internos al cliente
  const eventRows = await db
    .select({
      id: ticketEvents.id,
      eventType: ticketEvents.eventType,
      note: ticketEvents.note,
      actorRole: ticketEvents.actorRole,
      amountCents: ticketEvents.amountCents,
      currency: ticketEvents.currency,
      createdAt: ticketEvents.createdAt,
    })
    .from(ticketEvents)
    .where(and(eq(ticketEvents.ticketId, row.id), eq(ticketEvents.visibility, 'public')))
    .orderBy(ticketEvents.createdAt);

  // Filtrar eventos para no exponer metadata interna al cliente
  const publicEvents: PublicTicketEvent[] = eventRows.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    createdAt: e.createdAt,
    note: e.note,
    amountCents: e.amountCents,
    currency: e.currency,
    actorRole: e.actorRole,
  }));

  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    description: row.description,
    addonPublicName: row.addonPublicName ?? null,
    clientStatus,
    clientStatusLabel: CLIENT_STATUS_LABELS[clientStatus] ?? clientStatus,
    quoteStatus: row.quoteStatus,
    quoteRevision: row.quoteRevision,
    quotedPriceCents: row.quotedPriceCents ?? null,
    quoteScope: row.quoteScope ?? null,
    quoteEstimatedBusinessDays: row.quoteEstimatedBusinessDays ?? null,
    quoteExpiresAt: row.quoteExpiresAt ?? null,
    paypalOrderId: row.paypalOrderId ?? null,
    paypalOrderQuoteRevision: row.paypalOrderQuoteRevision ?? null,
    paidAt: row.paidAt ?? null,
    paidAmountCents: row.paidAmountCents ?? null,
    paidCurrency: row.paidCurrency ?? null,
    paymentMethod: row.paymentMethod ?? null,
    createdAt: row.createdAt,
    projectId: row.projectId,
    projectProductionUrl: row.productionUrl ?? null,
    events: publicEvents,
  };
}

// Acción del cliente: aceptar cotización
export async function acceptTicketQuote(
  ticketId: string,
  expectedQuoteRevision: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePortalClient();

  // Verificar propiedad
  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      status: tickets.status,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quoteExpiresAt: tickets.quoteExpiresAt,
      projectId: tickets.projectId,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(projects.clientId, ctx.client.id),
      ),
    )
    .limit(1);

  if (!ticket) return { ok: false, error: 'No encontrado.' };

  const now = new Date();

  if (ticket.quoteStatus !== 'priced') {
    return { ok: false, error: 'Solo puedes aceptar una cotización con precio.' };
  }
  if (ticket.quoteRevision !== expectedQuoteRevision) {
    return { ok: false, error: 'La cotización ha cambiado. Recarga para ver la versión vigente.' };
  }
  if (ticket.quoteExpiresAt && now >= ticket.quoteExpiresAt) {
    return { ok: false, error: 'Esta cotización ha vencido.' };
  }

  const [updated] = await db
    .update(tickets)
    .set({
      quoteStatus: 'accepted',
      quoteAcceptanceSource: 'portal',
      quoteRespondedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.quoteRevision, expectedQuoteRevision),
        eq(tickets.quoteStatus, 'priced'),
      ),
    )
    .returning({ id: tickets.id });

  if (!updated) {
    return { ok: false, error: 'La cotización ha cambiado. Recarga para ver la versión vigente.' };
  }

  const acceptEvent: NewTicketEvent = {
    ticketId: ticket.id,
    eventType: 'QUOTE_ACCEPTED',
    previousStatus: ticket.status,
    newStatus: ticket.status,
    actorId: ctx.userId,
    actorRole: 'client',
    quoteRevision: expectedQuoteRevision,
    acceptanceSource: 'portal',
    note: 'Cotización aceptada por el cliente desde el portal',
    visibility: 'public',
  };
  await db.insert(ticketEvents).values(acceptEvent);

  return { ok: true };
}

// Acción del cliente: rechazar cotización
export async function declineTicketQuote(
  ticketId: string,
  expectedQuoteRevision: number,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePortalClient();

  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quoteExpiresAt: tickets.quoteExpiresAt,
      projectId: tickets.projectId,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(projects.clientId, ctx.client.id),
      ),
    )
    .limit(1);

  if (!ticket) return { ok: false, error: 'No encontrado.' };

  if (ticket.quoteStatus !== 'priced') {
    return { ok: false, error: 'Solo puedes rechazar una cotización con precio.' };
  }
  if (ticket.quoteRevision !== expectedQuoteRevision) {
    return { ok: false, error: 'La cotización ha cambiado. Recarga para ver la versión vigente.' };
  }

  const cleanReason = reason?.trim().slice(0, 500) ?? null;
  const now = new Date();

  const [updated] = await db
    .update(tickets)
    .set({
      quoteStatus: 'declined',
      quoteResponseNote: cleanReason,
      quoteRespondedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.quoteRevision, expectedQuoteRevision),
        eq(tickets.quoteStatus, 'priced'),
      ),
    )
    .returning({ id: tickets.id });

  if (!updated) {
    return { ok: false, error: 'La cotización ha cambiado. Recarga.' };
  }

  const declineEvent: NewTicketEvent = {
    ticketId: ticket.id,
    eventType: 'QUOTE_DECLINED',
    previousStatus: ticket.status,
    newStatus: ticket.status,
    actorId: ctx.userId,
    actorRole: 'client',
    quoteRevision: expectedQuoteRevision,
    note: cleanReason,
    visibility: 'public',
  };
  await db.insert(ticketEvents).values(declineEvent);

  return { ok: true };
}

// ─── Nueva solicitud desde el portal ─────────────────────

export interface SubmitChangeRequestInput {
  projectId: string;
  description: string;  // lenguaje natural, 20-2000 chars
  title?: string;       // opcional — se deriva de description si omitido
}

export async function submitChangeRequest(
  input: SubmitChangeRequestInput,
): Promise<{ ok: boolean; ticketNumber?: string; error?: string }> {
  const ctx = await requirePortalClient();

  const description = input.description?.trim() ?? '';
  if (description.length < 20) {
    return { ok: false, error: 'Describe tu solicitud con al menos 20 caracteres.' };
  }
  if (description.length > 2000) {
    return { ok: false, error: 'La descripción no puede superar 2000 caracteres.' };
  }

  const rawTitle = input.title?.trim() ?? '';
  const title = rawTitle.length >= 5 ? rawTitle.slice(0, 120) : description.slice(0, 80);

  // Verificar propiedad y estado del proyecto
  const [project] = await db
    .select({ id: projects.id, status: projects.status, plan: projects.plan, productionUrl: projects.productionUrl })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.clientId, ctx.client.id)))
    .limit(1);

  if (!project) {
    return { ok: false, error: 'Proyecto no encontrado.' };
  }
  if (project.status !== 'LIVE') {
    return { ok: false, error: 'Solo puedes enviar solicitudes desde un proyecto activo.' };
  }

  const now = new Date();
  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;

  const [created] = await db
    .insert(tickets)
    .values({
      projectId: project.id,
      ticketNumber,
      addonType: 'CUSTOM',
      requestKind: 'change',
      title,
      description,
      priceAmount: 0,
      priceCurrency: 'USD',
      quoteStatus: 'requested',
      status: 'PENDING_APPROVAL',
      createdBy: 'CLIENT',
      clientSubmittedAt: now,
      submittedAt: now,
      dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tickets.id });

  if (!created) {
    return { ok: false, error: 'No se pudo crear la solicitud.' };
  }

  const submitEvent: NewTicketEvent = {
    ticketId: created.id,
    eventType: 'STATUS_CHANGED',
    previousStatus: null,
    newStatus: 'PENDING_APPROVAL',
    actorId: ctx.userId,
    actorRole: 'client',
    note: 'Solicitud enviada por el cliente desde el portal.',
    visibility: 'public',
  };
  await db.insert(ticketEvents).values(submitEvent);

  revalidatePath('/cambios-y-mejoras');
  return { ok: true, ticketNumber };
}

// ─── Preview IA (no escribe en BD) ───────────────────────

export async function previewChangeRequest(
  description: string,
  projectPlan: string,
  productionUrl: string | null,
): Promise<ChangeInterpretationResult> {
  const text = description?.trim() ?? '';
  if (text.length < 20 || text.length > 2000) {
    return { suggestions: [], overallSummary: '', source: 'fallback' };
  }

  // Solo pasar nombres y descripciones públicas al catálogo — sin IDs ni precios
  const catalogItems = await db
    .select({
      code: addonCatalog.code,
      publicName: addonCatalog.publicName,
      publicDescription: addonCatalog.publicDescription,
    })
    .from(addonCatalog)
    .where(eq(addonCatalog.visibleInPortal, true))
    .limit(40);

  const hints = catalogItems
    .filter((c) => c.publicName && c.publicDescription)
    .map((c) => ({
      code: c.code,
      publicName: c.publicName!,
      publicDescription: c.publicDescription!,
    }));

  return interpretChangeRequest({
    naturalText: text,
    projectContext: { productionUrl, plan: projectPlan },
    availableCatalogItems: hints,
  });
}
