'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { eq, count, desc } from 'drizzle-orm';
import { db } from '@/db';
import {
  addonCatalog,
  addonCatalogPlanRules,
  portalCategories,
  projectCapabilityUsage,
  projects,
  clients,
  catalogAdminEvents,
  admins,
} from '@/db/schema';
import { validateCatalogItemUpdate, validateCatalogDependencyGraph } from '@/lib/catalog/admin-validations';
import { isCatalogPortalVisibilityEditable, validateOperationalPriceChange } from '@/lib/catalog/catalog-safety';

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function assertAdmin(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  if (userId === process.env.ADMIN_CLERK_USER_ID) return userId;

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);
  if (!admin) return null;

  return userId;
}

function revalidateAll() {
  revalidatePath('/admin/configuracion');
  revalidatePath('/admin/tickets');
  revalidatePath('/admin/calculadora');
  revalidatePath('/proyecto/[projectId]/solicitudes', 'page');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// El driver HTTP de Neon no soporta `db.transaction`. La escritura y su registro
// de auditoría se ejecutan juntos con `db.batch`, que los envía en una sola
// petición y de forma atómica. Por eso esta función devuelve la consulta sin ejecutarla.
function auditEvent(actorId: string, action: string, detail: Record<string, unknown>) {
  return db.insert(catalogAdminEvents).values({
    actorId,
    action,
    entityType: 'catalog',
    entityId: (detail.itemId || detail.ruleId || detail.categoryId || 'system') as string,
    metadata: detail,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogAdminPlanRule = {
  id: string;
  addonCatalogId: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  availability: 'included' | 'paid' | 'quote' | 'unavailable';
  inclusionScope: 'initial_setup' | 'recurring_allowance' | null;
  initialIncludedQty: number;
  recurringIncludedQty: number;
  recurringPeriod: 'calendar_month' | null;
  overageMode: 'paid' | 'quote' | 'unavailable';
  overageAddonCode: string | null;
  allowedRequestKinds: string[];
};

export type CatalogAdminItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: 'design' | 'content' | 'integration' | 'revision' | 'custom';
  active: boolean;
  source: string;
  pricingMode: 'included' | 'fixed' | 'quote';
  listPriceCents: number;
  publicName: string | null;
  publicDescription: string | null;
  visibleInCalculator: boolean;
  visibleInTickets: boolean;
  visibleInProposals: boolean;
  visibleInPortal: boolean;
  portalCategoryId: string | null;
  sortOrder: number;
  adminNotes: string | null;
  dependencies: string[] | null;
  conflicts: (string | null)[] | null;
  planRules: CatalogAdminPlanRule[];
};

export type PortalCategoryAdmin = {
  id: string;
  name: string;
  publicName: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  active: boolean;
};

export type ItemUsageEntry = {
  projectId: string;
  ticketId: string | null;
  requestKind: string;
  decision: string;
  quantity: number;
  createdAt: Date;
  clientName: string | null;
  projectPlan: string | null;
  projectStatus: string | null;
};

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function listCatalogAdminAction(): Promise<{ items: CatalogAdminItem[] } | { error: string }> {
  if (!(await assertAdmin())) return { error: 'No autorizado' };
  try {
    const [items, rules] = await Promise.all([
      db.select().from(addonCatalog).orderBy(addonCatalog.category, addonCatalog.code),
      db.select().from(addonCatalogPlanRules),
    ]);
    const rulesByAddon = new Map<string, CatalogAdminPlanRule[]>();
    for (const rule of rules) {
      const list = rulesByAddon.get(rule.addonCatalogId) ?? [];
      list.push(rule as CatalogAdminPlanRule);
      rulesByAddon.set(rule.addonCatalogId, list);
    }
    return {
      items: items.map((item) => ({
        ...item,
        planRules: rulesByAddon.get(item.id) ?? [],
      })) as CatalogAdminItem[],
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al cargar catálogo' };
  }
}

export async function getItemUsageAction(addonCatalogId: string): Promise<
  { total: number; projects: number; usages: ItemUsageEntry[] } | { error: string }
> {
  if (!(await assertAdmin())) return { error: 'No autorizado' };
  try {
    const [[countRow], usageRows] = await Promise.all([
      db.select({ total: count() }).from(projectCapabilityUsage).where(eq(projectCapabilityUsage.addonCatalogId, addonCatalogId)),
      db
        .select({
          projectId: projectCapabilityUsage.projectId,
          ticketId: projectCapabilityUsage.ticketId,
          requestKind: projectCapabilityUsage.requestKind,
          decision: projectCapabilityUsage.decision,
          quantity: projectCapabilityUsage.quantity,
          createdAt: projectCapabilityUsage.createdAt,
          clientName: clients.fullName,
          projectPlan: projects.plan,
          projectStatus: projects.status,
        })
        .from(projectCapabilityUsage)
        .leftJoin(projects, eq(projectCapabilityUsage.projectId, projects.id))
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(projectCapabilityUsage.addonCatalogId, addonCatalogId))
        .orderBy(desc(projectCapabilityUsage.createdAt))
        .limit(15),
    ]);
    const distinctProjects = new Set(usageRows.map((r) => r.projectId)).size;
    return {
      total: countRow?.total ?? 0,
      projects: distinctProjects,
      usages: usageRows as ItemUsageEntry[],
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al cargar uso' };
  }
}

export async function listPortalCategoriesAction(): Promise<{ categories: PortalCategoryAdmin[] } | { error: string }> {
  if (!(await assertAdmin())) return { error: 'No autorizado' };
  try {
    const cats = await db
      .select()
      .from(portalCategories)
      .orderBy(portalCategories.sortOrder, portalCategories.name);
    return { categories: cats as PortalCategoryAdmin[] };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al cargar categorías' };
  }
}

// ─── Catalog item mutations ───────────────────────────────────────────────────

type UpdateCatalogInput = {
  id: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  category?: 'design' | 'content' | 'integration' | 'revision' | 'custom';
  active?: boolean;
  pricingMode?: 'included' | 'fixed' | 'quote';
  listPriceCents?: number;
  publicName?: string | null;
  publicDescription?: string | null;
  visibleInCalculator?: boolean;
  visibleInTickets?: boolean;
  visibleInProposals?: boolean;
  visibleInPortal?: boolean;
  portalCategoryId?: string | null;
  sortOrder?: number;
  adminNotes?: string | null;
  dependencies?: string[] | null;
  conflicts?: (string | null)[] | null;
};

export async function updateCatalogItemV3Action(input: UpdateCatalogInput) {
  const actorId = await assertAdmin();
  if (!actorId) return { error: 'No autorizado' };

  try {
    // Reject fields that must only change via canonical catalog updates
    const FORBIDDEN_FIELDS = [
      'pricingMode', 'active', 'name', 'category', 'description',
      'dependencies', 'conflicts', 'visibleInCalculator', 'visibleInTickets', 'visibleInProposals',
    ] as const;
    for (const field of FORBIDDEN_FIELDS) {
      if (field in input) {
        return { error: `El campo "${field}" no se puede modificar desde el panel de admin. Usa el catalogo canonico.` };
      }
    }

    // Fetch current item and its rules for validation context
    const [current] = await db
      .select({
        code: addonCatalog.code,
        portalCategoryId: addonCatalog.portalCategoryId,
        pricingMode: addonCatalog.pricingMode,
        priceCents: addonCatalog.priceCents,
        listPriceCents: addonCatalog.listPriceCents,
      })
      .from(addonCatalog)
      .where(eq(addonCatalog.id, input.id));
    if (!current) return { error: 'Ítem no encontrado.' };

    // Guard operational price changes using effective values (merge input over current DB)
    if (input.priceCents !== undefined || input.listPriceCents !== undefined) {
      const effectivePriceCents = input.priceCents ?? (current.priceCents ?? undefined);
      const effectiveListPriceCents = input.listPriceCents ?? (current.listPriceCents ?? undefined);
      const priceGuard = validateOperationalPriceChange(
        { code: current.code, pricingMode: current.pricingMode ?? 'fixed' },
        { priceCents: effectivePriceCents, listPriceCents: effectiveListPriceCents },
      );
      if (priceGuard) return { error: priceGuard };
    }

    // Guard portal visibility for protected codes
    if (input.visibleInPortal !== undefined && !isCatalogPortalVisibilityEditable(current.code)) {
      return { error: 'La visibilidad en portal no se puede editar para esta capacidad desde admin.' };
    }

    const rules = await db
      .select()
      .from(addonCatalogPlanRules)
      .where(eq(addonCatalogPlanRules.addonCatalogId, input.id));

    // Resolve effective portalCategoryId after this update
    const effectiveCategoryId = input.portalCategoryId !== undefined
      ? input.portalCategoryId
      : current.portalCategoryId;

    // Fetch category active state if needed
    let portalCategoryActive: boolean | null = null;
    if (input.visibleInPortal === true && effectiveCategoryId) {
      const [cat] = await db
        .select({ active: portalCategories.active })
        .from(portalCategories)
        .where(eq(portalCategories.id, effectiveCategoryId));
      portalCategoryActive = cat?.active ?? null;
    }

    const validationErr = validateCatalogItemUpdate(input, {
      code: current.code,
      effectivePortalCategoryId: effectiveCategoryId,
      portalCategoryActive,
      rules,
    });
    if (validationErr) return { error: validationErr };

    // Dependency graph validation
    if (input.dependencies !== undefined || input.conflicts !== undefined) {
      const knownItems = await db
        .select({ code: addonCatalog.code, dependencies: addonCatalog.dependencies })
        .from(addonCatalog);
      
      const nextDependencies = input.dependencies ?? [];
      const graphErr = validateCatalogDependencyGraph({
        currentCode: current.code,
        nextDependencies,
        knownItems,
      });
      if (graphErr) return { error: graphErr };

      // Ensure conflicts exist
      if (input.conflicts) {
        const knownCodes = new Set(knownItems.map((item) => item.code));
        for (const conflictCode of input.conflicts) {
          if (conflictCode && !knownCodes.has(conflictCode)) {
            return { error: `Conflicto inexistente: ${conflictCode}.` };
          }
        }
      }
    }

    const { id, ...updates } = input;
    const [[item]] = await db.batch([
      db
        .update(addonCatalog)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(addonCatalog.id, id))
        .returning(),
      auditEvent(actorId, 'catalog.item.updated', {
        itemId: id,
        code: current.code,
        fields: Object.keys(updates),
      }),
    ]);

    revalidateAll();
    return { item };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al actualizar ítem' };
  }
}

// ─── Plan rule mutations ──────────────────────────────────────────────────────

export async function upsertPlanRuleAction(_input: Omit<CatalogAdminPlanRule, 'id'> & { id?: string }) {
  return {
    error: 'Las reglas por plan son estructurales y no se modifican desde admin. Actualiza el catálogo canónico y corre validación.',
  };
}

export async function deletePlanRuleAction(_id: string) {
  return {
    error: 'Las reglas por plan son estructurales y no se modifican desde admin. Actualiza el catálogo canónico y corre validación.',
  };
}

// ─── Portal category mutations ────────────────────────────────────────────────

export async function savePortalCategoryAction(input: {
  id?: string;
  name: string;
  publicName: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  active?: boolean;
}) {
  const actorId = await assertAdmin();
  if (!actorId) return { error: 'No autorizado' };

  if (!input.name?.trim()) return { error: 'El nombre interno es requerido.' };
  if (!input.publicName?.trim()) return { error: 'El nombre público es requerido.' };

  try {
    const id = input.id ?? input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const values = {
      id,
      name: input.name.trim(),
      publicName: input.publicName.trim(),
      description: input.description?.trim() ?? null,
      icon: input.icon?.trim() ?? null,
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
      updatedAt: new Date(),
    };
    const [[cat]] = await db.batch([
      db
        .insert(portalCategories)
        .values({ ...values, createdAt: new Date() })
        .onConflictDoUpdate({ target: portalCategories.id, set: values })
        .returning(),
      auditEvent(actorId, 'catalog.portalCategory.saved', { categoryId: id, name: values.name }),
    ]);

    revalidateAll();
    return { category: cat as PortalCategoryAdmin };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al guardar categoría' };
  }
}

export async function deletePortalCategoryAction(id: string) {
  const actorId = await assertAdmin();
  if (!actorId) return { error: 'No autorizado' };

  try {
    // Block deletion if items are assigned to this category
    const [countRow] = await db
      .select({ n: count() })
      .from(addonCatalog)
      .where(eq(addonCatalog.portalCategoryId, id));
    const assignedCount = countRow?.n ?? 0;
    if (assignedCount > 0) {
      return {
        error: `Esta categoría tiene ${assignedCount} ítem(s) asignado(s). Reasigna o desvincula los ítems antes de eliminar.`,
      };
    }

    await db.batch([
      db.delete(portalCategories).where(eq(portalCategories.id, id)),
      auditEvent(actorId, 'catalog.portalCategory.deleted', { categoryId: id }),
    ]);
    revalidateAll();
    return { ok: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al eliminar categoría' };
  }
}
