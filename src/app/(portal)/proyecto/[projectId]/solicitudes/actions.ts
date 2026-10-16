'use server';

import { db } from '@/db';
import { addonCatalog, addonCatalogPlanRules, portalCategories, projectCapabilityUsage, ticketEvents, tickets } from '@/db/schema';
import { requireClientProject as _requireClientProject } from '@/lib/portal/context';
import { resolveCatalogRequest } from '@/lib/catalog/resolve-catalog-request';
import type { CatalogDecision, CatalogDecisionCode, CatalogRequestKind, SubscriptionPlan } from '@/lib/catalog/types';
import type {
  ClientTicket,
  PortalCatalogCategory,
  PortalCapabilityCard,
  SubmitCatalogRequestInput,
} from '@/lib/catalog/portal-types';
import { deriveClientTicketStatus } from '@/lib/tickets/billing';
import type { TicketQuoteStatus, TicketStatus } from '@/lib/tickets/billing';
import { and, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const ALLOWED_REQUEST_KINDS: CatalogRequestKind[] = [
  'initial_delivery',
  'change',
  'correction',
  'expansion',
  'maintenance',
  'reactivation',
];

async function requireClientProject(projectId: string) {
  const ctx = await _requireClientProject(projectId);
  return { project: ctx.project, userId: ctx.userId, isPreviewMode: ctx.isPreviewMode };
}

async function fetchItemContext(projectId: string, addonId: string, plan: string) {
  const [addon] = await db
    .select({
      id: addonCatalog.id,
      code: addonCatalog.code,
      name: addonCatalog.name,
      category: addonCatalog.category,
      active: addonCatalog.active,
      pricingMode: addonCatalog.pricingMode,
      priceCents: addonCatalog.priceCents,
      listPriceCents: addonCatalog.listPriceCents,
      visibleInPortal: addonCatalog.visibleInPortal,
      portalCategoryId: addonCatalog.portalCategoryId,
      dependencies: addonCatalog.dependencies,
      conflicts: addonCatalog.conflicts,
    })
    .from(addonCatalog)
    .where(eq(addonCatalog.id, addonId))
    .limit(1);
  if (!addon) throw new Error('Capacidad no encontrada.');

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
    .where(
      and(
        eq(addonCatalogPlanRules.addonCatalogId, addon.id),
        eq(addonCatalogPlanRules.plan, plan as SubscriptionPlan),
      ),
    )
    .limit(1);

  const usageHistory = await db
    .select({
      quantity: projectCapabilityUsage.quantity,
      decision: projectCapabilityUsage.decision,
      occurredAt: projectCapabilityUsage.createdAt,
    })
    .from(projectCapabilityUsage)
    .where(
      and(
        eq(projectCapabilityUsage.projectId, projectId),
        eq(projectCapabilityUsage.addonCatalogId, addon.id),
      ),
    );

  const deliveredRows = await db
    .select({ code: addonCatalog.code })
    .from(projectCapabilityUsage)
    .leftJoin(addonCatalog, eq(projectCapabilityUsage.addonCatalogId, addonCatalog.id))
    .where(eq(projectCapabilityUsage.projectId, projectId));
  const deliveredCapabilityCodes = deliveredRows.flatMap((r) => (r.code ? [r.code] : []));

  return { addon, planRule: planRule ?? null, usageHistory, deliveredCapabilityCodes };
}

async function assertItemVisibleInPortal(addon: {
  visibleInPortal: boolean;
  active: boolean;
  portalCategoryId: string | null;
}) {
  if (!addon.visibleInPortal || !addon.active || !addon.portalCategoryId) {
    throw new Error('Esta capacidad no está disponible en el portal.');
  }
  const [cat] = await db
    .select({ active: portalCategories.active })
    .from(portalCategories)
    .where(eq(portalCategories.id, addon.portalCategoryId))
    .limit(1);
  if (!cat?.active) throw new Error('Esta capacidad no está disponible en el portal.');
}

export async function getPortalCatalog(projectId: string): Promise<PortalCatalogCategory[]> {
  const { project } = await requireClientProject(projectId);

  const categories = await db
    .select({
      id: portalCategories.id,
      name: portalCategories.name,
      publicName: portalCategories.publicName,
      icon: portalCategories.icon,
      sortOrder: portalCategories.sortOrder,
      visibilityRule: portalCategories.visibilityRule,
    })
    .from(portalCategories)
    .where(eq(portalCategories.active, true))
    .orderBy(portalCategories.sortOrder);

  if (categories.length === 0) return [];

  // Filter categories by visibilityRule.
  // 'project_suspended' → only shows when SUSPENDED.
  // 'project_has_catalog' → only shows when plan is BUSINESS or LEGACY (catalog items are meaningful).
  const visibleCategories = categories.filter((c) => {
    if (c.visibilityRule === 'project_suspended') return project.status === 'SUSPENDED';
    if (c.visibilityRule === 'project_has_catalog') {
      return project.plan === 'BUSINESS' || project.plan === 'LEGACY';
    }
    return true;
  });

  if (visibleCategories.length === 0) return [];

  const activeCategoryIds = new Set(visibleCategories.map((c) => c.id));

  const items = await db
    .select({
      id: addonCatalog.id,
      code: addonCatalog.code,
      name: addonCatalog.name,
      category: addonCatalog.category,
      publicName: addonCatalog.publicName,
      publicDescription: addonCatalog.publicDescription,
      priceCents: addonCatalog.priceCents,
      listPriceCents: addonCatalog.listPriceCents,
      pricingMode: addonCatalog.pricingMode,
      active: addonCatalog.active,
      portalCategoryId: addonCatalog.portalCategoryId,
      dependencies: addonCatalog.dependencies,
      conflicts: addonCatalog.conflicts,
      sortOrder: addonCatalog.sortOrder,
    })
    .from(addonCatalog)
    .where(
      and(
        eq(addonCatalog.visibleInPortal, true),
        eq(addonCatalog.active, true),
        isNotNull(addonCatalog.portalCategoryId),
      ),
    );

  const visibleItems = items.filter((item) => activeCategoryIds.has(item.portalCategoryId!));
  if (visibleItems.length === 0) return [];

  // Batch: all plan rules for this plan
  const allPlanRules = await db
    .select({
      addonCatalogId: addonCatalogPlanRules.addonCatalogId,
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
    .where(eq(addonCatalogPlanRules.plan, project.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY'));

  const planRuleMap = new Map(allPlanRules.map((r) => [r.addonCatalogId, r]));

  // Batch: all usage for this project
  const allUsageRows = await db
    .select({
      addonCatalogId: projectCapabilityUsage.addonCatalogId,
      quantity: projectCapabilityUsage.quantity,
      decision: projectCapabilityUsage.decision,
      occurredAt: projectCapabilityUsage.createdAt,
    })
    .from(projectCapabilityUsage)
    .where(eq(projectCapabilityUsage.projectId, projectId));

  const usageByAddon = new Map<string, typeof allUsageRows>();
  for (const row of allUsageRows) {
    const list = usageByAddon.get(row.addonCatalogId) ?? [];
    list.push(row);
    usageByAddon.set(row.addonCatalogId, list);
  }

  // Delivered capability codes
  const deliveredRows = await db
    .select({ code: addonCatalog.code })
    .from(projectCapabilityUsage)
    .leftJoin(addonCatalog, eq(projectCapabilityUsage.addonCatalogId, addonCatalog.id))
    .where(eq(projectCapabilityUsage.projectId, projectId));
  const deliveredCapabilityCodes = deliveredRows.flatMap((r) => (r.code ? [r.code] : []));

  const now = new Date();
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const cards: (PortalCapabilityCard & { _sortOrder: number })[] = [];

  for (const item of visibleItems) {
    const planRule = planRuleMap.get(item.id) ?? null;
    const usageHistory = (usageByAddon.get(item.id) ?? []).map((u) => ({
      quantity: u.quantity,
      decision: u.decision as CatalogDecisionCode,
      occurredAt: u.occurredAt,
    }));
    const category = categoryMap.get(item.portalCategoryId!)!;

    const decision = resolveCatalogRequest({
      capability: {
        id: item.id,
        code: item.code,
        active: item.active,
        pricingMode: item.pricingMode,
        listPriceCents: item.listPriceCents,
        priceCents: item.priceCents,
        dependencies: item.dependencies,
        conflicts: item.conflicts,
      },
      planRule: planRule
        ? {
            availability: planRule.availability,
            inclusionScope: planRule.inclusionScope,
            initialIncludedQty: planRule.initialIncludedQty,
            recurringIncludedQty: planRule.recurringIncludedQty,
            recurringPeriod: planRule.recurringPeriod,
            overageMode: planRule.overageMode,
            overageAddonCode: planRule.overageAddonCode,
            allowedRequestKinds: planRule.allowedRequestKinds as CatalogRequestKind[],
          }
        : null,
      project: {
        id: project.id,
        plan: project.plan,
        status: project.status,
        postLaunchWarrantyEndsAt: project.postLaunchWarrantyEndsAt,
        suspendedAt: project.suspendedAt,
        reactivationFeeActive: project.reactivationFeeActive,
      },
      requestKind: 'change',
      quantity: 1,
      now,
      usageHistory,
      deliveredCapabilityCodes,
      availableCapabilityCodes: deliveredCapabilityCodes,
    });

    // Hide cards that are contextually blocked by suspension logic.
    const SUSPENSION_BLOCKED_REASONS = new Set([
      'suspended_commercial_blocked',
      'r01_not_yet_active',
      'r01_requires_suspended_project',
    ]);
    if (decision.nextAction === 'blocked' && SUSPENSION_BLOCKED_REASONS.has(decision.reasonCode)) {
      continue;
    }

    cards.push({
      id: item.id,
      code: item.code,
      publicName: item.publicName ?? item.name,
      publicDescription: item.publicDescription ?? '',
      categoryId: item.portalCategoryId!,
      categoryName: category.publicName,
      icon: category.icon,
      decision: decision.decision,
      nextAction: decision.nextAction,
      reasonCode: decision.reasonCode,
      priceCents: decision.unitPriceCents,
      listPriceCents: item.listPriceCents,
      includedRemaining: decision.includedRemaining,
      includedQuantity: decision.includedQuantity > 0 ? decision.includedQuantity : null,
      paidQuantity: decision.paidQuantity > 0 ? decision.paidQuantity : null,
      quoteQuantity: decision.quoteQuantity > 0 ? decision.quoteQuantity : null,
      unavailableQuantity: decision.unavailableQuantity > 0 ? decision.unavailableQuantity : null,
      allowedRequestKinds: (planRule?.allowedRequestKinds as CatalogRequestKind[]) ?? [],
      _sortOrder: item.sortOrder,
    });
  }

  const result: PortalCatalogCategory[] = [];
  for (const category of visibleCategories) {
    const categoryCards = cards
      .filter((c) => c.categoryId === category.id)
      .sort((a, b) => a._sortOrder - b._sortOrder)
      .map(({ _sortOrder: _s, ...card }) => card);
    if (categoryCards.length > 0) {
      result.push({
        id: category.id,
        name: category.name,
        publicName: category.publicName,
        icon: category.icon,
        items: categoryCards,
      });
    }
  }

  return result;
}

export async function previewCatalogRequest(input: {
  projectId: string;
  catalogItemId: string;
  requestKind: CatalogRequestKind;
  quantity: number;
}): Promise<CatalogDecision> {
  const { project } = await requireClientProject(input.projectId);
  const { addon, planRule, usageHistory, deliveredCapabilityCodes } = await fetchItemContext(
    input.projectId,
    input.catalogItemId,
    project.plan,
  );

  await assertItemVisibleInPortal(addon);

  // NO DB writes — pure evaluation
  return resolveCatalogRequest({
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
    planRule: planRule
      ? {
          availability: planRule.availability,
          inclusionScope: planRule.inclusionScope,
          initialIncludedQty: planRule.initialIncludedQty,
          recurringIncludedQty: planRule.recurringIncludedQty,
          recurringPeriod: planRule.recurringPeriod,
          overageMode: planRule.overageMode,
          overageAddonCode: planRule.overageAddonCode,
          allowedRequestKinds: planRule.allowedRequestKinds as CatalogRequestKind[],
        }
      : null,
    project: {
      id: project.id,
      plan: project.plan,
      status: project.status,
      postLaunchWarrantyEndsAt: project.postLaunchWarrantyEndsAt,
      suspendedAt: project.suspendedAt,
      reactivationFeeActive: project.reactivationFeeActive,
    },
    requestKind: input.requestKind,
    quantity: input.quantity,
    now: new Date(),
    usageHistory: usageHistory.map((u) => ({
      quantity: u.quantity,
      decision: u.decision as CatalogDecisionCode,
      occurredAt: u.occurredAt,
    })),
    deliveredCapabilityCodes,
    availableCapabilityCodes: deliveredCapabilityCodes,
  });
}

export async function submitCatalogRequest(
  input: SubmitCatalogRequestInput,
): Promise<{ ok: boolean; ticketId: string }> {
  const { project, userId, isPreviewMode } = await requireClientProject(input.projectId);
  if (isPreviewMode) throw new Error('Las solicitudes no están disponibles en modo preview.');

  if (!isValidUUID(input.projectId)) throw new Error('projectId inválido.');
  if (!isValidUUID(input.catalogItemId)) throw new Error('catalogItemId inválido.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    throw new Error('La cantidad debe ser al menos 1.');
  const cleanTitle = input.title.trim();
  const cleanDesc = input.description.trim();
  if (cleanTitle.length < 5) throw new Error('El título debe tener al menos 5 caracteres.');
  if (!cleanDesc) throw new Error('La descripción es requerida.');
  if (!ALLOWED_REQUEST_KINDS.includes(input.requestKind)) throw new Error('Tipo de solicitud inválido.');

  const { addon, planRule, usageHistory, deliveredCapabilityCodes } = await fetchItemContext(
    input.projectId,
    input.catalogItemId,
    project.plan,
  );

  await assertItemVisibleInPortal(addon);

  const effectiveQuantity =
    input.acceptedPartial && input.acceptedQuantity ? input.acceptedQuantity : input.quantity;

  const now = new Date();
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
    planRule: planRule
      ? {
          availability: planRule.availability,
          inclusionScope: planRule.inclusionScope,
          initialIncludedQty: planRule.initialIncludedQty,
          recurringIncludedQty: planRule.recurringIncludedQty,
          recurringPeriod: planRule.recurringPeriod,
          overageMode: planRule.overageMode,
          overageAddonCode: planRule.overageAddonCode,
          allowedRequestKinds: planRule.allowedRequestKinds as CatalogRequestKind[],
        }
      : null,
    project: {
      id: project.id,
      plan: project.plan,
      status: project.status,
      postLaunchWarrantyEndsAt: project.postLaunchWarrantyEndsAt,
      suspendedAt: project.suspendedAt,
      reactivationFeeActive: project.reactivationFeeActive,
    },
    requestKind: input.requestKind,
    quantity: effectiveQuantity,
    now,
    usageHistory: usageHistory.map((u) => ({
      quantity: u.quantity,
      decision: u.decision as CatalogDecisionCode,
      occurredAt: u.occurredAt,
    })),
    deliveredCapabilityCodes,
    availableCapabilityCodes: deliveredCapabilityCodes,
  });

  if (decision.nextAction === 'blocked') {
    throw new Error(`Solicitud bloqueada: ${decision.reasonCode}`);
  }

  if (decision.decision === 'unavailable') {
    throw new Error('Esta capacidad no está disponible para tu plan actual.');
  }

  if (decision.nextAction === 'show_partial_options' && !input.acceptedPartial) {
    throw new Error('PARTIAL_REQUIRES_CONFIRMATION');
  }

  const quoteStatus =
    decision.decision === 'quote_required' || decision.quoteQuantity > 0 ? 'requested' : 'none';
  const priceAmount = decision.totalPriceCents ?? 0;
  const addonType = mapAddonToTicketType(addon.code, addon.category, addon.name);

  const [created] = await db
    .insert(tickets)
    .values({
      projectId: input.projectId,
      addonCatalogId: addon.id,
      ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}`,
      addonType: addonType,
      requestKind: input.requestKind,
      title: cleanTitle,
      description: cleanDesc,
      priceAmount,
      priceCurrency: 'USD',
      billingDecision: decision.decision,
      catalogDecisionSnapshot: {
        ...decision,
        addonCode: addon.code,
        addonName: addon.name,
        acceptedPartial: input.acceptedPartial ?? false,
        acceptedQuantity: input.acceptedQuantity,
        originalQuantity: input.originalQuantity,
      },
      quoteStatus,
      status: 'PENDING_APPROVAL',
      createdBy: 'CLIENT',
      submittedAt: now,
      clientSubmittedAt: now,
      dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tickets.id });

  await db.insert(ticketEvents).values({
    ticketId: created.id,
    eventType: 'STATUS_CHANGED',
    previousStatus: null,
    newStatus: 'PENDING_APPROVAL',
    actorId: userId,
    actorRole: 'client',
    note: 'Solicitud enviada desde el portal',
    metadata: {
      source: 'portal_catalog_request',
      decision: decision.decision,
      nextAction: decision.nextAction,
      reasonCode: decision.reasonCode,
      quantity: effectiveQuantity,
      acceptedPartial: input.acceptedPartial ?? false,
    },
  });

  revalidatePath(`/proyecto/${input.projectId}/solicitudes`);
  revalidatePath('/admin/tickets');

  return { ok: true, ticketId: created.id };
}

export async function getProjectTickets(projectId: string): Promise<ClientTicket[]> {
  await requireClientProject(projectId);

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      status: tickets.status,
      billingDecision: tickets.billingDecision,
      quoteStatus: tickets.quoteStatus,
      priceAmount: tickets.priceAmount,
      createdAt: tickets.createdAt,
      addonPublicName: addonCatalog.publicName,
    })
    .from(tickets)
    .leftJoin(addonCatalog, eq(tickets.addonCatalogId, addonCatalog.id))
    .where(eq(tickets.projectId, projectId))
    .orderBy(tickets.createdAt);

  return rows.map((row) => ({
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    addonPublicName: row.addonPublicName ?? null,
    createdAt: row.createdAt,
    clientStatus: deriveClientTicketStatus(
      row.status as TicketStatus,
      row.billingDecision as CatalogDecisionCode | null,
      row.quoteStatus as TicketQuoteStatus,
    ),
    priceAmount: row.priceAmount,
    quoteStatus: row.quoteStatus,
  }));
}

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapAddonToTicketType(code: string, category: string, name: string) {
  const value = `${code} ${name}`.toLowerCase();
  if (value.includes('pagina') || value.includes('page')) return 'EXTRA_PAGE';
  if (value.includes('copy') || category === 'content') return 'COPYWRITING';
  if (value.includes('seo')) return 'SEO_BASICO';
  if (value.includes('booking') || value.includes('crm') || value.includes('api'))
    return 'INTEGRACION_BASICA';
  if (value.includes('e-commerce') || value.includes('ecommerce')) return 'INTEGRACION_AVANZADA';
  if (value.includes('motion') || value.includes('anim')) return 'MOTION_ANIMATION';
  if (category === 'design') return 'NEW_BLOCK';
  return 'CUSTOM';
}
