// Editor de propuesta — Xavier personaliza el borrador antes de enviarlo
// carga snapshot de catálogo para mostrar incluidos/add-ons/cotizables

import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProposalEditor } from './components/ProposalEditor';
import { getCatalogSnapshotForProposal } from '@/lib/catalog/catalog-loader';
import type { SubscriptionPlan } from '@/lib/catalog/types';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProposalEditorPage({ params }: PageProps) {
  const { projectId } = await params;
  const [row] = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      monthlyPriceCents: projects.monthlyPriceCents,
      setupFeeCents: projects.setupFeeCents,
      suggestedAddOns: projects.suggestedAddOns,
      catalogSnapshot: projects.catalogSnapshot,
      intakeSnapshot: projects.intakeSnapshot,
      internalNotes: projects.internalNotes,
      clientName: clients.fullName,
      clientEmail: clients.email,
      clientWhatsapp: clients.whatsapp,
      businessName: clients.businessName,
      industry: clients.industry,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) notFound();

  // Solo se puede editar propuesta en estados DRAFT o REQUIRES_REVIEW
  if (!['DRAFT', 'REQUIRES_REVIEW'].includes(row.status)) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">
          Esta propuesta ya fue enviada (estado: {row.status}).
        </p>
      </div>
    );
  }

  // Cargar snapshot comercial del proyecto (fuente de verdad).
  let catalogSnapshot = row.catalogSnapshot;
  let snapshotSource: 'project_snapshot' | 'quote_snapshot' | 'live_fallback' | 'legacy_none' = 'legacy_none';

  if (catalogSnapshot) {
    snapshotSource = 'project_snapshot';
  } else {
    // Si no tiene snapshot propio, usar fallback legacy
    catalogSnapshot = await getCatalogSnapshotForProposal(
      row.plan as SubscriptionPlan,
      // Pass legacy suggestedAddOns as pre-selected codes if present (old projects)
      row.suggestedAddOns?.length ? row.suggestedAddOns : undefined
    ).catch(() => null);

    if (catalogSnapshot) {
      snapshotSource = 'live_fallback';
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Propuesta para {row.clientName}
        </h1>
        <p className="text-sm text-gray-500">{row.businessName}</p>
      </div>
      <ProposalEditor project={{ ...row, catalogSnapshot, snapshotSource }} />
    </div>
  );
}

