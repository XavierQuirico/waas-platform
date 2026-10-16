import Link from 'next/link';
import { requireClientProject } from '@/lib/portal/context';
import { isPortalProjectNotFoundError } from '@/lib/portal/errors';
import PortalNotFound from '../not-found';
import { db } from '@/db';
import { projectAssets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ASSET_REQUIREMENTS } from '@/lib/assets/asset-requirements';
import { resolveAssetRequirementPlan } from '@/lib/assets/asset-ui';
import { AssetChecklist } from '../../../onboarding/assets/components/AssetChecklist';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectAssetsPage({ params }: PageProps) {
  const { projectId } = await params;

  let ctx: Awaited<ReturnType<typeof requireClientProject>>;
  try {
    ctx = await requireClientProject(projectId);
  } catch (err) {
    if (isPortalProjectNotFoundError(err)) return <PortalNotFound />;
    throw err;
  }

  const { project } = ctx!;

  const assets = await db
    .select()
    .from(projectAssets)
    .where(eq(projectAssets.projectId, project.id));

  const resolvedPlan = resolveAssetRequirementPlan(project.plan, project.projectType);
  const requirements = ASSET_REQUIREMENTS[resolvedPlan] ?? ASSET_REQUIREMENTS.BASIC;

  return (
    <section className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:max-w-5xl">
      {/* Back link */}
      <Link
        href={`/proyecto/${projectId}`}
        className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'rgba(249,249,249,0.35)' }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver al proyecto
      </Link>

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
