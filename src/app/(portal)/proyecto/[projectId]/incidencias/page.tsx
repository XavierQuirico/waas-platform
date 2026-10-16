import { getClientIncidentPageData } from './actions';
import { IncidenciasPageClient } from './components/IncidenciasPageClient';

export const dynamic = 'force-dynamic';

export default async function ClientIncidenciasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const pageData = await getClientIncidentPageData(projectId);

  return (
    <IncidenciasPageClient
      projectId={projectId}
      initialData={pageData}
    />
  );
}
