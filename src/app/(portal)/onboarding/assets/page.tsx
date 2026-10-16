import { requirePortalClient } from '@/lib/portal/context';
import { db } from '@/db';
import { projects, projectAssets } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { ASSET_REQUIREMENTS } from '@/lib/assets/asset-requirements';
import { deriveProjectType } from '@/lib/portal/project-type';
import { resolveAssetRequirementPlan } from '@/lib/assets/asset-ui';
import { AssetChecklist } from './components/AssetChecklist';

// Priority order for selecting which project to show in the asset onboarding flow.
// In case of multiple projects in asset collection states, we prefer the most urgent.
const ASSET_STATUS_PRIORITY = [
  'ASSETS_INCOMPLETE',
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
] as const;

type AssetStatus = (typeof ASSET_STATUS_PRIORITY)[number];

export default async function AssetsPage() {
  const { client } = await requirePortalClient();

  const clientProjects = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, client.id),
        inArray(projects.status, [...ASSET_STATUS_PRIORITY]),
      ),
    );

  if (clientProjects.length === 0) redirect('/dashboard');

  // Pick project with highest priority status; break ties by oldest createdAt
  const project = clientProjects.sort((a, b) => {
    const pa = ASSET_STATUS_PRIORITY.indexOf(a.status as AssetStatus);
    const pb = ASSET_STATUS_PRIORITY.indexOf(b.status as AssetStatus);
    if (pa !== pb) return pa - pb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];

  if (!project) redirect('/dashboard');

  const assets = await db
    .select()
    .from(projectAssets)
    .where(eq(projectAssets.projectId, project.id));

  // Portfolio → BASIC, LEGACY → BASIC, SUBSCRIPTION → plan real
  const projectType = deriveProjectType(project.plan, project.portfolioFlag);
  const resolvedPlan = resolveAssetRequirementPlan(project.plan, projectType);
  const requirements = ASSET_REQUIREMENTS[resolvedPlan] ?? ASSET_REQUIREMENTS.BASIC;

  return (
    <section className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6 lg:max-w-5xl">
      <AssetChecklist
        projectId={project.id}
        requirements={requirements}
        assets={assets}
        projectStatus={project.status}
        plan={resolvedPlan}
      />
    </section>
  );
}
