// Hub de proyecto — Admin Xavier
// Tabs: Resumen | Assets | Propuesta | Staging | Notas

import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { projects, clients, projectAssets, projectEvents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ASSET_REQUIREMENTS } from '@/lib/assets/asset-requirements';
import { PROJECT_STATUS_LABELS, getAllowedTransitions, type ProjectStatus } from '@/lib/projects/state-machine';
import Link from 'next/link';
import { AssetReviewPanel } from './components/AssetReviewPanel';
import { ProjectDetailHeader } from './components/ProjectDetailHeader';
import { ProjectResumenTab } from './components/ProjectResumenTab';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

const ASSET_REVIEW_STATES: ProjectStatus[] = [
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
];

const VALID_TABS = ['summary', 'assets', 'proposal', 'staging', 'notes'];

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const sp = await searchParams;
  const tab = VALID_TABS.includes(sp.tab ?? '') ? (sp.tab as string) : 'summary';

  const { userId } = await auth();
  if (!userId || userId !== ADMIN_CLERK_USER_ID) redirect(`/acceder?context=admin&redirect_url=${encodeURIComponent(`/proyectos/${projectId}`)}`);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      monthlyPriceCents: projects.monthlyPriceCents,
      internalNotes: projects.internalNotes,
      stagingUrl: projects.stagingUrl,
      productionUrl: projects.productionUrl,
      productionDeadlineAt: projects.productionDeadlineAt,
      stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
      createdAt: projects.createdAt,
      liveAt: projects.liveAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) notFound();

  // ─── Preparar datos ────────────────────────────────────────────────────────

  const plan = project.plan as 'BASIC' | 'PRO' | 'BUSINESS';
  const requirements = ASSET_REQUIREMENTS[plan] ?? ASSET_REQUIREMENTS.BASIC;
  const canReview = ASSET_REVIEW_STATES.includes(project.status as ProjectStatus);
  const statusLabel = PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status;
  const allowedTransitions = getAllowedTransitions(project.status as ProjectStatus);

  // Calcular SLA hours
  const deadline = project.productionDeadlineAt ?? project.stagingReviewDeadlineAt;
  const slaHours = deadline
    ? Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)))
    : null;

  // ─── Tabs config ────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'summary',  label: 'Resumen',   show: true },
    { key: 'assets',   label: 'Assets',    show: canReview },
    { key: 'proposal', label: 'Propuesta', show: true },
    { key: 'staging',  label: 'Staging',   show: true },
    { key: 'notes',    label: 'Notas',     show: true },
  ].filter((t) => t.show);

  const activeTab = tabs.find((t) => t.key === tab) ? tab : 'summary';
  const [client, assets, events] = await Promise.all([
    db
      .select({
        fullName: clients.fullName,
        email: clients.email,
        whatsapp: clients.whatsapp,
        businessName: clients.businessName,
      })
      .from(clients)
      .innerJoin(projects, eq(projects.clientId, clients.id))
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((rows) => rows[0]),
    activeTab === 'assets'
      ? db
          .select()
          .from(projectAssets)
          .where(eq(projectAssets.projectId, projectId))
          .orderBy(projectAssets.assetKey, projectAssets.fileIndex)
      : Promise.resolve([]),
    activeTab === 'summary'
      ? db
          .select()
          .from(projectEvents)
          .where(eq(projectEvents.projectId, projectId))
          .orderBy(desc(projectEvents.createdAt))
          .limit(50)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-6">

      {/* Back link */}
      <Link
        href="/admin/proyectos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        ← Proyectos
      </Link>

      {/* Header interactivo (client component para dropdown de estado) */}
      <ProjectDetailHeader
        projectId={projectId}
        businessName={client?.businessName ?? 'Sin nombre'}
        clientName={client?.fullName ?? ''}
        clientEmail={client?.email ?? ''}
        clientWhatsapp={client?.whatsapp ?? null}
        status={project.status as ProjectStatus}
        statusLabel={statusLabel}
        plan={plan}
        monthlyPriceCents={project.monthlyPriceCents}
        slaHours={slaHours}
        stagingUrl={project.stagingUrl ?? null}
        productionUrl={project.productionUrl ?? null}
        allowedTransitions={allowedTransitions}
      />

      {/* Tab navigation */}
      <div className="mb-6 flex border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/proyectos/${projectId}?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && (
        <ProjectResumenTab
          project={{
            id: project.id,
            plan,
            monthlyPriceCents: project.monthlyPriceCents,
            createdAt: project.createdAt,
            productionDeadlineAt: project.productionDeadlineAt ?? null,
            stagingUrl: project.stagingUrl ?? null,
            productionUrl: project.productionUrl ?? null,
            internalNotes: project.internalNotes ?? null,
          }}
          client={{
            fullName: client?.fullName ?? '',
            email: client?.email ?? '',
            whatsapp: client?.whatsapp ?? null,
            businessName: client?.businessName ?? '',
          }}
          events={events}
        />
      )}

      {activeTab === 'assets' && canReview && (
        <AssetReviewPanel
          projectId={project.id}
          plan={plan}
          requirements={requirements}
          assets={assets}
          project={project}
          canReview={canReview}
        />
      )}

      {activeTab === 'assets' && !canReview && (
        <div className="rounded-lg border border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">
            La revisión de assets no está disponible en el estado actual ({statusLabel}).
          </p>
        </div>
      )}

      {activeTab === 'proposal' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="mb-4 text-sm text-gray-600">
            Crea o edita la propuesta para este proyecto.
          </p>
          <Link
            href={`/admin/proyectos/${projectId}/proposal`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Abrir editor de propuesta →
          </Link>
        </div>
      )}

      {activeTab === 'staging' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="mb-2 text-sm font-medium text-gray-700">URL de Staging</p>
          {project.stagingUrl ? (
            <div className="flex items-center gap-3">
              <a
                href={project.stagingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {project.stagingUrl}
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Aún no hay staging desplegado. Puedes subir la URL desde el panel de assets cuando la producción esté lista.
            </p>
          )}
          {project.productionUrl && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-gray-700">URL de Producción</p>
              <a
                href={project.productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:underline"
              >
                {project.productionUrl}
              </a>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="mb-3 text-sm font-semibold text-gray-700">Notas internas — Solo admin</p>
          {project.internalNotes ? (
            <pre className="whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
              {project.internalNotes}
            </pre>
          ) : (
            <p className="text-sm text-gray-400">Sin notas internas aún.</p>
          )}
        </div>
      )}
    </div>
  );
}
