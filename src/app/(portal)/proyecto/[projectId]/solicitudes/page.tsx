import { getPortalCatalog, getProjectTickets } from './actions';
import { SolicitudesPageClient } from './components/SolicitudesPageClient';
import { isPortalProjectNotFoundError } from '@/lib/portal/errors';
import PortalNotFound from '../not-found';
import type { PortalCatalogCategory, ClientTicket } from '@/lib/catalog/portal-types';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function SolicitudesPage({ params }: PageProps) {
  const { projectId } = await params;

  let categories: PortalCatalogCategory[];
  let tickets: ClientTicket[];

  try {
    [categories, tickets] = await Promise.all([
      getPortalCatalog(projectId),
      getProjectTickets(projectId),
    ]);
  } catch (err) {
    if (isPortalProjectNotFoundError(err)) return <PortalNotFound />;
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Solicitudes</h1>
        <p className="mt-1 text-sm text-white/40">
          Solicita cambios y capacidades adicionales para tu sitio.
        </p>
      </div>

      <SolicitudesPageClient
        categories={categories!}
        tickets={tickets!}
        projectId={projectId}
      />
    </div>
  );
}
