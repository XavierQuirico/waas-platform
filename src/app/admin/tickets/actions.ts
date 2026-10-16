'use server';

import { db } from '@/db';
import {
  addonCatalog,
  addonCatalogPlanRules,
  projectCapabilityUsage,
  projects,
  ticketEvents,
  tickets,
} from '@/db/schema';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import { requireAdmin } from '@/lib/admin/auth';
import { paypalFetch } from '@/lib/paypal/client';
import {
  canStartTicketWork,
  getNextQuoteStatus,
  safeParsePayPalAmountCents,
  shouldRecordIncludedUsage,
  type QuoteAction,
  type TicketQuoteStatus,
  type TicketStatus,
} from '@/lib/tickets/billing';
import type { CatalogDecisionCode, CatalogRequestKind } from '@/lib/catalog/types';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type PayPalOrderDetail = {
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

// Eventos que el cliente debe ver en su portal
const PUBLIC_EVENT_TYPES = new Set([
  'QUOTE_SENT',
  'QUOTE_ACCEPTED',
  'QUOTE_DECLINED',
  'QUOTE_EXPIRED',
  'MANUAL_PAYMENT_RECORDED',
  'PAYPAL_ORDER_CREATED',
  'PAYPAL_CAPTURE_COMPLETED',
  'PAYPAL_RECONCILED',
]);

type TicketEventType =
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED'
  | 'PAYPAL_ORDER_CREATED'
  | 'QUOTE_SENT'
  | 'QUOTE_ACCEPTED'
  | 'MANUAL_PAYMENT_RECORDED'
  | 'PAYPAL_RECONCILED';

type TicketStatusValue =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

type QuoteAcceptanceSourceValue =
  | 'portal'
  | 'whatsapp'
  | 'phone'
  | 'in_person'
  | 'other';

async function addTicketEvent(
  ticketId: string,
  eventType: TicketEventType,
  previousStatus: TicketStatusValue | null,
  newStatus: TicketStatusValue | null,
  opts: {
    actorId?: string;
    actorRole?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    quoteRevision?: number;
    amountCents?: number;
    currency?: string;
    acceptanceSource?: QuoteAcceptanceSourceValue;
    visibility?: 'public' | 'internal';
  } = {},
) {
  const visibility = opts.visibility ?? (PUBLIC_EVENT_TYPES.has(eventType) ? 'public' : 'internal');
  await db.insert(ticketEvents).values({
    ticketId,
    eventType,
    previousStatus,
    newStatus,
    actorId: opts.actorId ?? 'SYSTEM',
    actorRole: opts.actorRole ?? 'admin',
    note: opts.note,
    metadata: opts.metadata,
    quoteRevision: opts.quoteRevision,
    amountCents: opts.amountCents,
    currency: opts.currency,
    acceptanceSource: opts.acceptanceSource,
    visibility,
  });
}

export async function approveTicket(ticketId: string) {
  const { userId } = await requireAdmin();
  const now = new Date();
  const [updated] = await db
    .update(tickets)
    .set({ status: 'APPROVED', approvedAt: now, updatedAt: now })
    .where(eq(tickets.id, ticketId))
    .returning({ id: tickets.id });

  if (!updated) throw new Error('Ticket no encontrado.');
  await addTicketEvent(ticketId, 'STATUS_CHANGED', 'PENDING_APPROVAL', 'APPROVED', {
    actorId: userId,
    actorRole: 'admin',
  });
  revalidatePath('/admin/tickets');
  return { ok: true };
}

export async function rejectTicket(ticketId: string, reason: string) {
  const { userId } = await requireAdmin();
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('La razon de rechazo es obligatoria.');

  const now = new Date();
  const [updated] = await db
    .update(tickets)
    .set({
      status: 'REJECTED',
      quoteStatus: 'rejected',
      rejectionReason: cleanReason,
      rejectedAt: now,
      updatedAt: now,
    })
    .where(eq(tickets.id, ticketId))
    .returning({ id: tickets.id });

  if (!updated) throw new Error('Ticket no encontrado.');
  await addTicketEvent(ticketId, 'STATUS_CHANGED', 'PENDING_APPROVAL', 'REJECTED', {
    actorId: userId,
    actorRole: 'admin',
    note: cleanReason,
  });
  revalidatePath('/admin/tickets');
  return { ok: true };
}

// requestPayment (admin genera PayPal order) fue eliminado.
// El pago lo inicia el cliente desde su portal via /api/portal/tickets/[n]/paypal/order.

export async function startWork(ticketId: string) {
  const { userId } = await requireAdmin();
  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      billingDecision: tickets.billingDecision,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');
  canStartTicketWork({
    status: ticket.status as TicketStatus,
    billingDecision: ticket.billingDecision as CatalogDecisionCode | null,
  });

  const now = new Date();
  const [updated] = await db
    .update(tickets)
    .set({ status: 'IN_PROGRESS', startedAt: now, updatedAt: now })
    .where(eq(tickets.id, ticketId))
    .returning({ id: tickets.id });

  if (!updated) throw new Error('Ticket no encontrado.');
  await addTicketEvent(ticketId, 'STATUS_CHANGED', ticket.status, 'IN_PROGRESS', {
    actorId: userId,
    actorRole: 'admin',
  });
  revalidatePath('/admin/tickets');
  return { ok: true };
}

export async function completeTicket(ticketId: string) {
  const { userId } = await requireAdmin();
  const now = new Date();
  const [updated] = await db
    .update(tickets)
    .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
    .where(eq(tickets.id, ticketId))
    .returning({
      id: tickets.id,
      projectId: tickets.projectId,
      addonCatalogId: tickets.addonCatalogId,
      requestKind: tickets.requestKind,
      billingDecision: tickets.billingDecision,
      catalogDecisionSnapshot: tickets.catalogDecisionSnapshot,
    });

  if (!updated) throw new Error('Ticket no encontrado.');

  if (
    updated.addonCatalogId
    && shouldRecordIncludedUsage('COMPLETED', updated.billingDecision as CatalogDecisionCode | null)
  ) {
    await db
      .insert(projectCapabilityUsage)
      .values({
        projectId: updated.projectId,
        addonCatalogId: updated.addonCatalogId,
        ticketId: updated.id,
        usageKey: `ticket:${updated.id}:included`,
        requestKind: updated.requestKind,
        decision: updated.billingDecision ?? 'included_allowance',
        quantity: getSnapshotIncludedQuantity(updated.catalogDecisionSnapshot),
        periodKey: getCalendarMonthKey(now),
        decisionSnapshot: updated.catalogDecisionSnapshot,
      })
      .onConflictDoNothing();
  }

  await addTicketEvent(ticketId, 'STATUS_CHANGED', 'IN_PROGRESS', 'COMPLETED', {
    actorId: userId,
    actorRole: 'admin',
  });
  revalidatePath('/admin/tickets');
  return { ok: true };
}

export async function createTicket(formData: FormData) {
  const { userId } = await requireAdmin();
  const projectId = String(formData.get('projectId') || '');
  const addonCatalogId = String(formData.get('addonCatalogId') || '');
  const addonCode = String(formData.get('addonCode') || '').trim();
  const addonName = String(formData.get('addonName') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const requestKind = String(formData.get('requestKind') || 'change').trim();

  if (!projectId || !addonCatalogId || !title) {
    throw new Error('Proyecto activo, add-on y titulo son obligatorios.');
  }

  const [addon] = await db
    .select({
      id: addonCatalog.id,
      code: addonCatalog.code,
      name: addonCatalog.name,
      category: addonCatalog.category,
      active: addonCatalog.active,
      priceCents: addonCatalog.priceCents,
      pricingMode: addonCatalog.pricingMode,
      listPriceCents: addonCatalog.listPriceCents,
      dependencies: addonCatalog.dependencies,
      conflicts: addonCatalog.conflicts,
    })
    .from(addonCatalog)
    .where(eq(addonCatalog.id, addonCatalogId))
    .limit(1);

  if (!addon) throw new Error('El add-on seleccionado no existe.');

  const [project] = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      status: projects.status,
      postLaunchWarrantyEndsAt: projects.postLaunchWarrantyEndsAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) throw new Error('El proyecto seleccionado no existe.');

  const [planRule] = await db
    .select({
      availability: addonCatalogPlanRules.availability,
      inclusionScope: addonCatalogPlanRules.inclusionScope,
      initialIncludedQty: addonCatalogPlanRules.initialIncludedQty,
      recurringIncludedQty: addonCatalogPlanRules.recurringIncludedQty,
      recurringPeriod: addonCatalogPlanRules.recurringPeriod,
      overageMode: addonCatalogPlanRules.overageMode,
      overageAddonCode: addonCatalogPlanRules.overageAddonCode,
      allowedRequestKinds: addonCatalogPlanRules.allowedRequestKinds,
    })
    .from(addonCatalogPlanRules)
    .where(and(
      eq(addonCatalogPlanRules.addonCatalogId, addon.id),
      eq(addonCatalogPlanRules.plan, project.plan),
    ))
    .limit(1);

  const usageHistory = await db
    .select({
      quantity: projectCapabilityUsage.quantity,
      decision: projectCapabilityUsage.decision,
      occurredAt: projectCapabilityUsage.createdAt,
    })
    .from(projectCapabilityUsage)
    .where(and(
      eq(projectCapabilityUsage.projectId, projectId),
      eq(projectCapabilityUsage.addonCatalogId, addon.id),
    ));

  const deliveredRows = await db
    .select({
      code: addonCatalog.code,
    })
    .from(projectCapabilityUsage)
    .leftJoin(addonCatalog, eq(projectCapabilityUsage.addonCatalogId, addonCatalog.id))
    .where(eq(projectCapabilityUsage.projectId, projectId));
  const deliveredCapabilityCodes = deliveredRows.flatMap((row) => row.code ? [row.code] : []);

  const decision = resolveCatalogRequest({
    capability: {
      id: addon.id,
      code: addon.code,
      active: addon.active,
      pricingMode: addon.pricingMode,
      listPriceCents: addon.listPriceCents,
      priceCents: addon.priceCents,
      dependencies: addon.dependencies,
      conflicts: addon.conflicts,
    },
    planRule: planRule ? {
      availability: planRule.availability,
      inclusionScope: planRule.inclusionScope,
      initialIncludedQty: planRule.initialIncludedQty,
      recurringIncludedQty: planRule.recurringIncludedQty,
      recurringPeriod: planRule.recurringPeriod,
      overageMode: planRule.overageMode,
      overageAddonCode: planRule.overageAddonCode,
      allowedRequestKinds: planRule.allowedRequestKinds as CatalogRequestKind[],
    } : null,
    project: {
      id: project.id,
      plan: project.plan,
      status: project.status,
      postLaunchWarrantyEndsAt: project.postLaunchWarrantyEndsAt,
    },
    requestKind: requestKind as CatalogRequestKind,
    quantity: 1,
    now: new Date(),
    usageHistory: usageHistory.map((usage) => ({
      quantity: usage.quantity,
      decision: usage.decision as CatalogDecisionCode,
      occurredAt: usage.occurredAt,
    })),
    deliveredCapabilityCodes,
    availableCapabilityCodes: deliveredCapabilityCodes,
  });

  if (decision.nextAction === 'blocked') {
    throw new Error(`La solicitud esta bloqueada: ${decision.reasonCode}.`);
  }

  const addonType = mapAddonToTicketType(addon.code, addon.category, addon.name);
  const quoteStatus = decision.decision === 'quote_required' ? 'requested' : 'none';
  const priceAmount = decision.totalPriceCents ?? 0;
  const now = new Date();

  const [created] = await db
    .insert(tickets)
    .values({
      projectId,
      addonCatalogId: addon.id,
      ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}`,
      addonType: addonType,
      requestKind: requestKind as CatalogRequestKind,
      title,
      description,
      internalNotes: `Add-on catalogo: ${addon.code} - ${addon.name} (${addon.id})`,
      customPriceReason: null,
      priceAmount,
      priceCurrency: 'USD',
      billingDecision: decision.decision,
      catalogDecisionSnapshot: {
        ...decision,
        addonCode: addonCode || addon.code,
        addonName: addonName || addon.name,
      },
      quoteStatus,
      status: 'PENDING_APPROVAL',
      createdBy: 'ADMIN',
      submittedAt: now,
      dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tickets.id });

  await addTicketEvent(created.id, 'STATUS_CHANGED', null, 'PENDING_APPROVAL', {
    actorId: userId,
    actorRole: 'admin',
    note: 'Ticket creado por admin',
  });
  revalidatePath('/admin/tickets');
  return { ok: true };
}

export async function updateTicketQuoteStatus(
  ticketId: string,
  action: QuoteAction,
  input: { quotedPriceCents?: number; note?: string; expiresAt?: Date } = {},
) {
  const { userId } = await requireAdmin();
  const [ticket] = await db
    .select({
      id: tickets.id,
      quoteStatus: tickets.quoteStatus,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');

  const nextStatus = getNextQuoteStatus(ticket.quoteStatus as TicketQuoteStatus, action);
  const now = new Date();

  if (nextStatus === 'priced') {
    if (!input.quotedPriceCents || input.quotedPriceCents <= 0) {
      throw new Error('El precio cotizado debe ser mayor a $0.');
    }
  }

  await db.update(tickets).set({
    quoteStatus: nextStatus,
    quoteResponseNote: input.note?.trim() || null,
    quoteRespondedAt: now,
    updatedAt: now,
    ...(nextStatus === 'priced' && input.quotedPriceCents ? {
      quotedPriceCents: input.quotedPriceCents,
      priceAmount: input.quotedPriceCents,
      quoteExpiresAt: input.expiresAt ?? new Date(now.getTime() + 7 * 86_400_000),
    } : {}),
  }).where(eq(tickets.id, ticketId));
  await addTicketEvent(ticketId, 'NOTE_ADDED', null, null, {
    actorId: userId,
    actorRole: 'admin',
    note: `Quote status: ${nextStatus}`,
    metadata: { quoteStatus: nextStatus },
  });
  revalidatePath('/admin/tickets');
  return { quoteStatus: nextStatus };
}

// ─── Zod schemas for new actions ──────────────────────────

const sendQuoteSchema = z.object({
  quoteScope: z.string().min(20).max(2000),
  priceCents: z.number().int().positive(),
  validityDays: z.number().int().min(1).max(30).default(7),
  estimatedBusinessDays: z.number().int().min(1).max(60).optional(),
  internalNote: z.string().max(2000).optional(),
});

const recordAcceptanceSchema = z.object({
  acceptanceSource: z.enum(['whatsapp', 'phone', 'in_person', 'other']),
  expectedQuoteRevision: z.number().int().nonnegative(),
  quoteScope: z.string().min(20).max(2000).optional(),
  priceCents: z.number().int().positive().optional(),
  validityDays: z.number().int().min(1).max(30).optional(),
  estimatedBusinessDays: z.number().int().min(1).max(60).optional(),
});

const BLOCKED_STATUSES_FOR_QUOTE = new Set([
  'PAID',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
]);

// ─── 1. sendTicketQuote ───────────────────────────────────

export async function sendTicketQuote(
  ticketId: string,
  rawInput: {
    quoteScope: string;
    priceCents: number;
    validityDays?: number;
    estimatedBusinessDays?: number;
    internalNote?: string;
  },
) {
  const { userId } = await requireAdmin();
  const input = sendQuoteSchema.parse(rawInput);

  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');

  if (BLOCKED_STATUSES_FOR_QUOTE.has(ticket.status)) {
    throw new Error(`No se puede enviar cotización en estado ${ticket.status}.`);
  }
  if (ticket.quoteStatus === 'accepted') {
    throw new Error('La cotización ya fue aceptada. No se puede re-cotizar.');
  }

  const newRevision = ticket.quoteRevision + 1;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.validityDays * 86_400_000);

  const result = await db
    .update(tickets)
    .set({
      status: 'APPROVED',
      quoteStatus: 'priced',
      quoteRevision: newRevision,
      quotedPriceCents: input.priceCents,
      priceAmount: input.priceCents,
      quoteScope: input.quoteScope,
      quoteEstimatedBusinessDays: input.estimatedBusinessDays ?? null,
      quoteSentAt: now,
      quoteExpiresAt: expiresAt,
      quoteResponseNote: null,
      quoteRespondedAt: null,
      approvedAt: now,
      updatedAt: now,
      ...(input.internalNote ? { internalNotes: input.internalNote } : {}),
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.quoteRevision, ticket.quoteRevision)))
    .returning({ id: tickets.id });

  if (result.length === 0) {
    throw new Error('Conflicto: la cotización fue modificada mientras se enviaba. Recarga e intenta de nuevo.');
  }

  await addTicketEvent(ticketId, 'QUOTE_SENT', ticket.status, 'APPROVED', {
    actorId: userId,
    actorRole: 'admin',
    quoteRevision: newRevision,
    amountCents: input.priceCents,
    currency: 'USD',
  });

  revalidatePath('/admin/tickets');
  revalidatePath('/cambios-y-mejoras');
  return { ok: true, newRevision };
}

// ─── 2. recordTicketQuoteAcceptance ───────────────────────

export async function recordTicketQuoteAcceptance(
  ticketId: string,
  rawInput: {
    acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
    expectedQuoteRevision: number;
    quoteScope?: string;
    priceCents?: number;
    validityDays?: number;
    estimatedBusinessDays?: number;
  },
) {
  const { userId } = await requireAdmin();
  const input = recordAcceptanceSchema.parse(rawInput);

  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quotedPriceCents: tickets.quotedPriceCents,
      quoteExpiresAt: tickets.quoteExpiresAt,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');

  const now = new Date();
  const isExpired = ticket.quoteExpiresAt ? now >= ticket.quoteExpiresAt : false;
  let revisionUsed = input.expectedQuoteRevision;

  if (ticket.quoteStatus === 'priced' && !isExpired) {
    if (ticket.quoteRevision !== input.expectedQuoteRevision) {
      throw new Error('La revisión de cotización no coincide. Recarga e intenta de nuevo.');
    }

    const result = await db
      .update(tickets)
      .set({
        quoteStatus: 'accepted' as const,
        quoteAcceptanceSource: input.acceptanceSource,
        quoteRespondedAt: now,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.quoteRevision, input.expectedQuoteRevision)))
      .returning({ id: tickets.id });

    if (result.length === 0) {
      throw new Error('Conflicto al registrar aceptación. Recarga e intenta de nuevo.');
    }
  } else if (
    ['none', 'requested', 'needs_info'].includes(ticket.quoteStatus ?? '') &&
    input.quoteScope &&
    input.priceCents
  ) {
    // Create + accept in one update
    const newRevision = ticket.quoteRevision + 1;
    revisionUsed = newRevision;
    const validityDays = input.validityDays ?? 7;
    const expiresAt = new Date(now.getTime() + validityDays * 86_400_000);

    const result = await db
      .update(tickets)
      .set({
        status: 'APPROVED' as const,
        quoteStatus: 'accepted' as const,
        quoteRevision: newRevision,
        quotedPriceCents: input.priceCents,
        priceAmount: input.priceCents,
        quoteScope: input.quoteScope,
        quoteEstimatedBusinessDays: input.estimatedBusinessDays ?? null,
        quoteSentAt: now,
        quoteExpiresAt: expiresAt,
        quoteAcceptanceSource: input.acceptanceSource,
        quoteRespondedAt: now,
        approvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.quoteRevision, ticket.quoteRevision)))
      .returning({ id: tickets.id });

    if (result.length === 0) {
      throw new Error('Conflicto al crear y aceptar cotización. Recarga e intenta de nuevo.');
    }
  } else {
    throw new Error(
      'No es posible registrar aceptación: la cotización está en un estado incompatible o faltan datos del precio.',
    );
  }

  await addTicketEvent(ticketId, 'QUOTE_ACCEPTED', null, null, {
    actorId: userId,
    actorRole: 'admin',
    quoteRevision: revisionUsed,
    acceptanceSource: input.acceptanceSource,
  });

  revalidatePath('/admin/tickets');
  revalidatePath('/cambios-y-mejoras');
  return { ok: true };
}

// ─── 3. recordManualTicketPayment ─────────────────────────

const manualPaymentSchema = z.object({
  acceptanceSource: z.enum(['whatsapp', 'phone', 'in_person', 'other']),
  expectedQuoteRevision: z.number().int().nonnegative(),
  paidAmountCents: z.number().int().positive(),
  paidCurrency: z.literal('USD'),
  paidAt: z.date(),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'paypal_external', 'other']),
  paymentReference: z.string().max(200).optional(),
  confirmExplicit: z.literal(true),
  quoteScope: z.string().min(20).max(2000).optional(),
  priceCents: z.number().int().positive().optional(),
  validityDays: z.number().int().min(1).max(30).optional(),
});

export async function recordManualTicketPayment(
  ticketId: string,
  rawInput: {
    acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
    expectedQuoteRevision: number;
    paidAmountCents: number;
    paidCurrency: 'USD';
    paidAt: Date;
    paymentMethod: 'bank_transfer' | 'cash' | 'paypal_external' | 'other';
    paymentReference?: string;
    confirmExplicit: true;
    quoteScope?: string;
    priceCents?: number;
    validityDays?: number;
  },
) {
  const { userId } = await requireAdmin();
  const input = manualPaymentSchema.parse(rawInput);

  // Reference required for bank_transfer, paypal_external, other
  if (['bank_transfer', 'paypal_external', 'other'].includes(input.paymentMethod)) {
    if (!input.paymentReference?.trim()) {
      throw new Error(`La referencia de pago es obligatoria para el método ${input.paymentMethod}.`);
    }
  }

  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      quoteStatus: tickets.quoteStatus,
      quoteRevision: tickets.quoteRevision,
      quotedPriceCents: tickets.quotedPriceCents,
      priceAmount: tickets.priceAmount,
      paypalOrderId: tickets.paypalOrderId,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');

  const BLOCKED_STATUSES_FOR_MANUAL_PAYMENT = new Set([
    'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED',
  ]);
  if (BLOCKED_STATUSES_FOR_MANUAL_PAYMENT.has(ticket.status)) {
    throw new Error(`No se puede registrar pago manual en estado ${ticket.status}.`);
  }
  if (ticket.paypalOrderId) {
    throw new Error(
      'Existe una orden PayPal activa. Reconcíliala antes de registrar un pago manual.',
    );
  }

  const now = new Date();
  let revisionUsed = input.expectedQuoteRevision;

  // Determine if we need to create quote first
  const needsQuoteCreate =
    ['none', 'requested', 'needs_info'].includes(ticket.quoteStatus ?? '') &&
    input.quoteScope &&
    input.priceCents;

  // Amount must match: when creating a new quote, use input.priceCents; otherwise use existing quote amount
  const expectedAmount = needsQuoteCreate
    ? input.priceCents!
    : (ticket.quotedPriceCents ?? ticket.priceAmount);
  if (input.paidAmountCents !== expectedAmount) {
    throw new Error(
      `El monto pagado (${input.paidAmountCents}¢) no coincide con el monto cotizado (${expectedAmount}¢). Crea una nueva revisión primero.`,
    );
  }

  if (needsQuoteCreate) {
    revisionUsed = ticket.quoteRevision + 1;
    const validityDays = input.validityDays ?? 7;
    const expiresAt = new Date(now.getTime() + validityDays * 86_400_000);

    const result = await db
      .update(tickets)
      .set({
        status: 'PAID' as const,
        quoteStatus: 'accepted' as const,
        quoteRevision: revisionUsed,
        quotedPriceCents: input.priceCents,
        priceAmount: input.priceCents,
        quoteScope: input.quoteScope,
        quoteSentAt: now,
        quoteExpiresAt: expiresAt,
        quoteAcceptanceSource: input.acceptanceSource,
        quoteRespondedAt: now,
        approvedAt: now,
        paidAt: input.paidAt,
        paidAmountCents: input.paidAmountCents,
        paidCurrency: input.paidCurrency,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference ?? null,
        paymentRecordedBy: userId,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.quoteRevision, ticket.quoteRevision)))
      .returning({ id: tickets.id });

    if (result.length === 0) {
      throw new Error('Conflicto al registrar pago manual. Recarga e intenta de nuevo.');
    }
  } else {
    if (ticket.quoteRevision !== input.expectedQuoteRevision) {
      throw new Error('La revisión de cotización no coincide. Recarga e intenta de nuevo.');
    }

    const result = await db
      .update(tickets)
      .set({
        status: 'PAID' as const,
        quoteStatus: 'accepted' as const,
        quoteAcceptanceSource: input.acceptanceSource,
        quoteRespondedAt: now,
        paidAt: input.paidAt,
        paidAmountCents: input.paidAmountCents,
        paidCurrency: input.paidCurrency,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference ?? null,
        paymentRecordedBy: userId,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.quoteRevision, input.expectedQuoteRevision)))
      .returning({ id: tickets.id });

    if (result.length === 0) {
      throw new Error('Conflicto al registrar pago manual. Recarga e intenta de nuevo.');
    }
  }

  // Insert QUOTE_ACCEPTED event if needed
  if (ticket.quoteStatus !== 'accepted') {
    await addTicketEvent(ticketId, 'QUOTE_ACCEPTED', null, null, {
      actorId: userId,
      actorRole: 'admin',
      quoteRevision: revisionUsed,
      acceptanceSource: input.acceptanceSource,
    });
  }

  await addTicketEvent(ticketId, 'MANUAL_PAYMENT_RECORDED', ticket.status, 'PAID', {
    actorId: userId,
    actorRole: 'admin',
    quoteRevision: revisionUsed,
    amountCents: input.paidAmountCents,
    currency: input.paidCurrency,
    metadata: {
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference ?? null,
    },
  });

  revalidatePath('/admin/tickets');
  revalidatePath('/cambios-y-mejoras');
  return { ok: true };
}

// ─── 4. reconcileTicketPayPalPayment ──────────────────────

export async function reconcileTicketPayPalPayment(ticketId: string) {
  const { userId } = await requireAdmin();

  const [ticket] = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      status: tickets.status,
      paypalOrderId: tickets.paypalOrderId,
      paypalOrderAmountCents: tickets.paypalOrderAmountCents,
      paypalOrderQuoteRevision: tickets.paypalOrderQuoteRevision,
      quoteRevision: tickets.quoteRevision,
      paidAt: tickets.paidAt,
      paypalCaptureId: tickets.paypalCaptureId,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) throw new Error('Ticket no encontrado.');
  if (!ticket.paypalOrderId) throw new Error('No hay orden PayPal activa para este ticket.');
  if (ticket.status === 'PAID') {
    return { ok: true, alreadyPaid: true } as const;
  }

  const order = await paypalFetch<PayPalOrderDetail>(
    `/v2/checkout/orders/${ticket.paypalOrderId}`,
    'GET',
  );

  if (order.status === 'COMPLETED') {
    const capture = order.purchase_units?.[0]?.payments?.captures?.find(
      (c) => c.status === 'COMPLETED',
    );

    if (!capture) {
      return {
        ok: false,
        status: 'completed_no_capture',
        message: 'El pedido está COMPLETED pero no se encontró una captura completada.',
      } as const;
    }

    // Validate amount using safe parser (no parseFloat)
    const captureAmountCents = capture.amount?.value
      ? safeParsePayPalAmountCents(capture.amount.value)
      : null;
    if (capture.amount?.value && captureAmountCents === null) {
      return {
        ok: false,
        status: 'invalid_amount',
        message: `Importe de captura inválido: "${capture.amount.value}".`,
      } as const;
    }
    const expectedCents = ticket.paypalOrderAmountCents;

    if (capture.amount?.currency_code && capture.amount.currency_code !== 'USD') {
      return {
        ok: false,
        status: 'currency_mismatch',
        message: 'La moneda de la captura no es USD.',
      } as const;
    }

    if (expectedCents !== null && captureAmountCents !== null && captureAmountCents !== expectedCents) {
      return {
        ok: false,
        status: 'amount_mismatch',
        message: `Monto de captura (${captureAmountCents}¢) no coincide con lo esperado (${expectedCents}¢).`,
      } as const;
    }

    const now = new Date();
    const [reconciled] = await db
      .update(tickets)
      .set({
        status: 'PAID' as const,
        paidAt: now,
        paypalCaptureId: capture.id,
        paidAmountCents: captureAmountCents ?? expectedCents ?? ticket.paypalOrderAmountCents,
        paidCurrency: 'USD',
        paymentMethod: 'paypal_checkout' as const,
        updatedAt: now,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'PAYMENT_PENDING')))
      .returning({ id: tickets.id });

    if (!reconciled) {
      return {
        ok: false,
        status: 'not_payment_pending',
        message: 'El ticket ya no está en estado PAYMENT_PENDING; reconciliación omitida.',
      } as const;
    }

    await addTicketEvent(ticketId, 'PAYPAL_RECONCILED', ticket.status, 'PAID', {
      actorId: userId,
      actorRole: 'admin',
      quoteRevision: ticket.paypalOrderQuoteRevision ?? ticket.quoteRevision ?? undefined,
      amountCents: captureAmountCents ?? undefined,
      currency: 'USD',
      metadata: {
        paypalOrderId: ticket.paypalOrderId,
        captureId: capture.id,
      },
    });

    revalidatePath('/admin/tickets');
    revalidatePath('/cambios-y-mejoras');
    return { ok: true, status: 'completed' } as const;
  }

  if (order.status === 'APPROVED') {
    return {
      ok: false,
      status: 'approved_not_captured',
      message: 'El cliente aprobó el pago pero no se capturó aún.',
    } as const;
  }

  if (order.status === 'CREATED') {
    return {
      ok: false,
      status: 'pending_approval',
      message: 'El cliente aún no ha aprobado el pago.',
    } as const;
  }

  return {
    ok: false,
    status: order.status,
    message: 'El pedido falló o expiró.',
  } as const;
}

function mapAddonToTicketType(code: string, category: string, name: string) {
  const value = `${code} ${name}`.toLowerCase();
  if (value.includes('pagina') || value.includes('pagina') || value.includes('page')) return 'EXTRA_PAGE';
  if (value.includes('copy') || category === 'content') return 'COPYWRITING';
  if (value.includes('seo')) return 'SEO_BASICO';
  if (value.includes('booking') || value.includes('crm') || value.includes('api')) return 'INTEGRACION_BASICA';
  if (value.includes('e-commerce') || value.includes('ecommerce')) return 'INTEGRACION_AVANZADA';
  if (value.includes('motion') || value.includes('anim')) return 'MOTION_ANIMATION';
  if (category === 'design') return 'NEW_BLOCK';
  return 'CUSTOM';
}

function getCalendarMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getSnapshotIncludedQuantity(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return 1;
  const value = (snapshot as { includedQuantity?: unknown }).includedQuantity;
  return typeof value === 'number' && value > 0 ? value : 1;
}
