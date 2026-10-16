import { db } from '@/db';
import { clients, projects } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { ClientesPageClient } from './ClientesPageClient';

export const metadata = { title: 'Clientes — QUIRICO STUDIOS Admin' };

export default async function ClientesPage() {
  // Traer todos los clientes con aggregado de proyectos
  const rows = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      email: clients.email,
      whatsapp: clients.whatsapp,
      businessName: clients.businessName,
      industry: clients.industry,
      location: clients.location,
      currentUrl: clients.currentUrl,
      createdAt: clients.createdAt,
      projectCount: sql<number>`cast(count(${projects.id}) as int)`,
      mrrCents: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}) filter (where ${projects.status} = 'LIVE'), 0) as int)`,
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(desc(clients.createdAt));

  return <ClientesPageClient initialRows={rows} />;
}
