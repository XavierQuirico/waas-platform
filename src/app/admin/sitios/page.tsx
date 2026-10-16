// Vista de todos los sitios activos — Admin Xavier
// Muestra proyectos en PRODUCTION_STARTED, STAGING_REVIEW, REVISIONS,
// REVISIONS_DONE, LIVE, SUSPENDED ordenados por relevancia

import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { SitiosList } from './components/SitiosList';
import type { ProjectStatus } from '@/lib/projects/state-machine';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sitios activos — WaaS Admin' };

const ACTIVE_STATUSES: ProjectStatus[] = [
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'LIVE',
  'SUSPENDED',
];

export default async function SitiosAdminPage() {
  const rows = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      monthlyPriceCents: projects.monthlyPriceCents,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
      productionDeadlineAt: projects.productionDeadlineAt,
      stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
      liveAt: projects.liveAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      clientName: clients.fullName,
      clientEmail: clients.email,
      clientWhatsapp: clients.whatsapp,
      businessName: clients.businessName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(inArray(projects.status, ACTIVE_STATUSES))
    .orderBy(projects.updatedAt);

  const live = rows.filter((r) => r.status === 'LIVE');
  const suspended = rows.filter((r) => r.status === 'SUSPENDED');
  const inProgress = rows.filter((r) =>
    ['PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE'].includes(r.status)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-7 pb-0 shrink-0">
        <div className="mb-6">
          <h1
            style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text)' }}
          >
            Sitios
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-3)', fontFamily: "'Inter Tight', sans-serif" }}>
            <span style={{ color: '#5DD69C' }}>{live.length} en vivo</span>
            {' · '}
            <span style={{ color: '#6B9FFF' }}>{inProgress.length} en producción</span>
            {suspended.length > 0 && (
              <>
                {' · '}
                <span style={{ color: '#F87171' }}>{suspended.length} suspendidos</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        <SitiosList live={live} inProgress={inProgress} suspended={suspended} />
      </div>
    </div>
  );
}
