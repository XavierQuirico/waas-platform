import { getPortalShellData } from '@/lib/portal/context';
import { db } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildConfigurationViewModel } from '@/lib/portal/configuration-view-model';
import { ConfiguracionView } from './ConfiguracionForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configuración — Quirico Studios',
};

export default async function ConfiguracionPage() {
  const shell = await getPortalShellData();

  const [client] = await db
    .select({
      fullName: clients.fullName,
      email: clients.email,
      businessName: clients.businessName,
      whatsapp: clients.whatsapp,
      location: clients.location,
      currentUrl: clients.currentUrl,
      industry: clients.industry,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, shell.client.id))
    .limit(1);

  if (!client) {
    return (
      <div style={{ maxWidth: 680 }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
          No pudimos cargar los datos de tu cuenta. Inténtalo de nuevo en unos minutos.
        </p>
      </div>
    );
  }

  const viewModel = buildConfigurationViewModel({
    client: {
      fullName: client.fullName,
      businessName: client.businessName,
      email: client.email,
      whatsapp: client.whatsapp ?? null,
      location: client.location ?? null,
      currentUrl: client.currentUrl ?? null,
      industry: client.industry,
      createdAt: client.createdAt ?? null,
    },
    project: shell.project
      ? {
          plan: shell.project.plan,
          portfolioFlag: shell.project.portfolioFlag,
          status: shell.project.status,
          stagingUrl: shell.project.stagingUrl,
          productionUrl: shell.project.productionUrl,
        }
      : null,
  });

  return <ConfiguracionView viewModel={viewModel} />;
}
