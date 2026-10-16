import { requirePortalClient } from '@/lib/portal/context';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects/state-machine';

function resolveIncidentProjectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? 'En activación';
}

function resolveIncidentProjectDisplayName(
  project: { productionUrl: string | null; domainTarget: string | null },
  index: number,
): string {
  return project.productionUrl ?? project.domainTarget ?? `Sitio ${index + 1}`;
}

export const dynamic = 'force-dynamic';

export default async function IncidenciasGlobalPage() {
  const { client } = await requirePortalClient();

  const clientProjects = await db
    .select({
      id: projects.id,
      productionUrl: projects.productionUrl,
      domainTarget: projects.domainTarget,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.clientId, client.id))
    .orderBy(desc(projects.createdAt))
    .limit(50);

  // No projects at all
  if (clientProjects.length === 0) {
    return (
      <div className="max-w-[600px]">
        <h1 className="font-headline text-[22px] font-bold text-[var(--text)] mb-2">
          Incidencias
        </h1>
        <div className="bg-[var(--surface)] rounded-lg p-6 text-center">
          <p className="text-[13px] text-[var(--text-3)]">
            Aún no tienes un proyecto activo para reportar incidencias.
          </p>
        </div>
      </div>
    );
  }

  // Single project — redirect directly
  if (clientProjects.length === 1) {
    redirect(`/proyecto/${clientProjects[0].id}/incidencias`);
  }

  // Multiple projects — show selector
  return (
    <div className="max-w-[600px]">
      <h1 className="font-headline text-[22px] font-bold text-[var(--text)] mb-2">
        Incidencias
      </h1>
      <p className="text-[13px] text-[var(--text-3)] mb-6">
        Selecciona el proyecto para ver o reportar incidencias.
      </p>

      <div className="flex flex-col gap-2">
        {clientProjects.map((project, index) => {
          const displayName = resolveIncidentProjectDisplayName(project, index);
          const statusLabel = resolveIncidentProjectStatusLabel(project.status);

          return (
            <a
              key={project.id}
              href={`/proyecto/${project.id}/incidencias`}
              aria-label={`Ver incidencias de ${displayName}`}
              className="flex items-center justify-between gap-3 bg-[var(--surface)] rounded-lg border border-[rgba(128,128,128,0.12)] px-4 py-[14px] no-underline transition-[border-color] duration-150 hover:border-[rgba(128,128,128,0.25)]"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {displayName}
                </p>
                <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                  {statusLabel}
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[var(--text-3)] shrink-0"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
