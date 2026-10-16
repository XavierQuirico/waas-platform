import Link from 'next/link';
import { requireClientProject } from '@/lib/portal/context';
import { isPortalProjectNotFoundError } from '@/lib/portal/errors';
import PortalNotFound from './not-found';
import { db } from '@/db';
import { projectAssets, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  getProjectPhases,
  getProjectCurrentPhaseIndex,
  getProjectStatusBadge,
  getProjectTypeLabel,
} from '@/lib/portal/dashboard-state';
import { toExternalUrl } from '@/lib/portal/url';
import { getPortalProjectDisplayName } from '@/lib/portal/project-display';
import {
  resolveAssetRequirementPlan,
  getAssetPageMode,
  getAssetProgress,
} from '@/lib/assets/asset-ui';
import { ASSET_REQUIREMENTS } from '@/lib/assets/asset-requirements';
import { ProjectPhaseBar } from './components/ProjectPhaseBar';
import { ProjectMaterialsSummary } from './components/ProjectMaterialsSummary';
import { ProjectPreviewSummary } from './components/ProjectPreviewSummary';
import { whatsappUrl } from '@/lib/config/contact';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

const WA_LINK = whatsappUrl();

const BADGE_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  neutral: { text: 'rgba(249,249,249,0.6)', border: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.05)' },
  amber: { text: '#FF8C00', border: 'rgba(255,140,0,0.3)', bg: 'rgba(255,140,0,0.08)' },
  violet: { text: '#D4B8FF', border: 'rgba(212,184,255,0.3)', bg: 'rgba(212,184,255,0.07)' },
  blue: { text: '#6B9FFF', border: 'rgba(107,159,255,0.3)', bg: 'rgba(107,159,255,0.07)' },
  green: { text: '#5DD69C', border: 'rgba(93,214,156,0.3)', bg: 'rgba(93,214,156,0.07)' },
  red: { text: '#EF4444', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.07)' },
};

function StatusBadge({ label, type }: { label: string; type: string }) {
  const colors = BADGE_COLORS[type] ?? BADGE_COLORS.neutral;
  return (
    <span
      className="inline-block rounded-full border px-2.5 py-0.5 font-semibold uppercase"
      style={{
        fontSize: 9,
        letterSpacing: '0.06em',
        color: colors.text,
        borderColor: colors.border,
        background: colors.bg,
        fontFamily: 'var(--font-body)',
      }}
    >
      {label}
    </span>
  );
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const { projectId } = await params;

  let ctx: Awaited<ReturnType<typeof requireClientProject>>;
  try {
    ctx = await requireClientProject(projectId);
  } catch (err) {
    // Expected not-found/forbidden → render the human message INLINE (notFound()
    // leaves the streamed shell <main> empty). Real DB/runtime errors propagate.
    if (isPortalProjectNotFoundError(err)) return <PortalNotFound />;
    throw err;
  }

  const { project } = ctx!;

  // Fetch assets + all of THIS client's projects (for the human, multi-project
  // safe label). The projects query is scoped by clientId — never cross-tenant.
  const [assets, clientProjects] = await Promise.all([
    db.select().from(projectAssets).where(eq(projectAssets.projectId, project.id)),
    db
      .select({
        id: projects.id,
        createdAt: projects.createdAt,
        productionUrl: projects.productionUrl,
        stagingUrl: projects.stagingUrl,
        domainTarget: projects.domainTarget,
      })
      .from(projects)
      .where(eq(projects.clientId, project.clientId))
      .orderBy(projects.createdAt),
  ]);

  // Human project label: "Sitio principal" when the client has a single project,
  // otherwise a legible host (productionUrl → domainTarget → stagingUrl) or
  // "Sitio N". Never a UUID, hash, or "Proyecto #..." style label.
  const currentIndex = Math.max(
    0,
    clientProjects.findIndex((p) => p.id === project.id),
  );
  const currentMeta = clientProjects[currentIndex];
  const projectDisplayName = getPortalProjectDisplayName({
    index: currentIndex,
    total: clientProjects.length,
    productionUrl: currentMeta?.productionUrl ?? project.productionUrl,
    stagingUrl: currentMeta?.stagingUrl ?? project.stagingUrl,
    domainTarget: currentMeta?.domainTarget ?? null,
  });

  // Derive display data
  const typeLabel = getProjectTypeLabel(project.plan, project.portfolioFlag);
  const statusBadge = getProjectStatusBadge(project.status);
  const phases = getProjectPhases(project.projectType);
  const currentPhaseIndex = getProjectCurrentPhaseIndex(project.status, project.projectType);

  const resolvedPlan = resolveAssetRequirementPlan(project.plan, project.projectType);
  const requirements = ASSET_REQUIREMENTS[resolvedPlan] ?? ASSET_REQUIREMENTS.BASIC;
  const progress = getAssetProgress(
    requirements,
    assets.map((a) => ({ assetKey: a.assetKey, status: a.status })),
  );
  const assetMode = getAssetPageMode(project.status);

  // Normalize URLs for staging/production links
  const normalizedStagingUrl = toExternalUrl(project.stagingUrl);
  const normalizedProductionUrl = toExternalUrl(project.productionUrl);

  // Format creation date
  const createdAt = currentMeta?.createdAt;
  const createdLabel = createdAt
    ? `Creado el ${createdAt.toLocaleDateString('es-DO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`
    : null;

  return (
    <section className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Type + status badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={typeLabel} type="neutral" />
            <StatusBadge label={statusBadge.label} type={statusBadge.type} />
          </div>

          {/* Project name */}
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            {projectDisplayName}
          </h1>

          {/* Created date */}
          {createdLabel && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {createdLabel}
            </p>
          )}
        </div>

        {/* WhatsApp CTA */}
        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-white/20"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'rgba(249,249,249,0.7)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          Contactar a Xavier
        </a>
      </div>

      {/* ─── Phase bar ───────────────────────────────────── */}
      <section
        className="rounded-xl border p-5"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
        aria-label="Fases del proyecto"
      >
        <p
          className="mb-4 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(249,249,249,0.3)', fontFamily: 'var(--font-body)' }}
        >
          Progreso del proyecto
        </p>
        <ProjectPhaseBar phases={phases} currentIndex={currentPhaseIndex} />
      </section>

      {/* ─── Materials summary ───────────────────────────── */}
      <ProjectMaterialsSummary
        projectId={project.id}
        progress={progress}
        mode={assetMode}
      />

      {/* ─── Preview / Revisiones ────────────────────────── */}
      <ProjectPreviewSummary
        projectId={project.id}
        status={project.status}
        stagingUrl={normalizedStagingUrl}
        productionUrl={normalizedProductionUrl}
      />

      {/* ─── Documents (empty state) ─────────────────────── */}
      <section
        className="rounded-xl border p-5"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
        aria-label="Documentos"
      >
        <h2
          className="mb-1 text-sm font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          Documentos
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Los documentos aparecerán aquí cuando estén disponibles.
        </p>
      </section>

      {/* ─── Back link ───────────────────────────────────── */}
      <div className="pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'rgba(249,249,249,0.35)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
