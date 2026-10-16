import 'server-only';

import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { maintenanceContracts } from '@/db/schema/maintenance-contracts';
import { eq, and, desc } from 'drizzle-orm';
import { deriveProjectType } from '@/lib/portal/project-type';
import type { ProjectType } from '@/lib/portal/project-type';
export {
  formatTierLabel,
  formatTierChanges,
  formatBillingMethod,
  formatContractStatus,
  formatMoneyCents,
} from '@/lib/portal/maintenance-helpers';

export interface MantenimientoProject {
  id: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  portfolioFlag: boolean;
  projectType: ProjectType;
  status: string;
  productionUrl: string | null;
  createdAt: Date;
}

export interface MantenimientoContract {
  id: string;
  tier: string;
  monthlyPriceCents: number;
  hostingIncluded: boolean;
  hostingPriceCents: number;
  billingMethod: string;
  paypalSubscriptionId: string | null;
  status: string;
  startedAt: Date;
  nextBillingAt: Date | null;
}

export interface MantenimientoPageData {
  legacyProjects: MantenimientoProject[];
  selectedProject: MantenimientoProject | null;
  contracts: MantenimientoContract[];
}

export async function getMantenimientoPageData(
  clientId: string,
  requestedProjectId?: string,
): Promise<MantenimientoPageData> {
  const rawProjects = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
      productionUrl: projects.productionUrl,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.createdAt));

  // Filter to Legacy only
  const legacyProjects: MantenimientoProject[] = rawProjects
    .map((p) => {
      const plan = p.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
      const projectType = deriveProjectType(plan, p.portfolioFlag);
      return { ...p, plan, projectType, productionUrl: p.productionUrl ?? null };
    })
    .filter((p) => p.projectType === 'LEGACY');

  if (!legacyProjects.length) {
    return { legacyProjects: [], selectedProject: null, contracts: [] };
  }

  // Validate ownership — only within legacy projects
  let selected = legacyProjects[0];
  if (requestedProjectId) {
    const match = legacyProjects.find((p) => p.id === requestedProjectId);
    if (match) selected = match;
  }

  const rawContracts = await db
    .select({
      id: maintenanceContracts.id,
      tier: maintenanceContracts.tier,
      monthlyPriceCents: maintenanceContracts.monthlyPriceCents,
      hostingIncluded: maintenanceContracts.hostingIncluded,
      hostingPriceCents: maintenanceContracts.hostingPriceCents,
      billingMethod: maintenanceContracts.billingMethod,
      paypalSubscriptionId: maintenanceContracts.paypalSubscriptionId,
      status: maintenanceContracts.status,
      startedAt: maintenanceContracts.startedAt,
      nextBillingAt: maintenanceContracts.nextBillingAt,
    })
    .from(maintenanceContracts)
    .where(
      and(
        eq(maintenanceContracts.clientId, clientId),
        eq(maintenanceContracts.projectId, selected.id),
      ),
    )
    .orderBy(desc(maintenanceContracts.startedAt));

  const contracts: MantenimientoContract[] = rawContracts.map((c) => ({
    id: c.id,
    tier: c.tier,
    monthlyPriceCents: c.monthlyPriceCents,
    hostingIncluded: c.hostingIncluded,
    hostingPriceCents: c.hostingPriceCents,
    billingMethod: c.billingMethod,
    paypalSubscriptionId: c.paypalSubscriptionId ?? null,
    status: c.status,
    startedAt: c.startedAt,
    nextBillingAt: c.nextBillingAt ?? null,
  }));

  return { legacyProjects, selectedProject: selected, contracts };
}

