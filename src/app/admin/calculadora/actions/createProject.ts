'use server';
// ============================================================
// Server Action — Crear Proyecto desde Propuesta de Calculadora
// Flujo: crea cliente (si no existe) + proyecto en estado DRAFT
// ============================================================

import { db } from '@/db';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';
import { eq } from 'drizzle-orm';
import type { ClientContextInput, ProposalData } from '@/lib/calculadora/types';
import { isAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/admin/auth';

type CreateProjectResult =
  | { success: true; projectId: string }
  | { success: false; error: string };

/**
 * Convierte el plan de la calculadora al enum del schema de proyectos.
 */
function mapPlan(
  projectType: ClientContextInput['projectType'],
  subscriptionPlan?: ClientContextInput['subscriptionPlan']
): 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY' {
  if (projectType === 'legacy') return 'LEGACY';
  if (!subscriptionPlan) return 'BASIC';
  return subscriptionPlan.toUpperCase() as 'BASIC' | 'PRO' | 'BUSINESS';
}

export async function createProjectFromProposalAction(
  clientInput: ClientContextInput,
  proposalData: ProposalData
): Promise<CreateProjectResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    // ─── 1. Upsert del cliente ────────────────────────────
    // La calculadora no recoge email — se usa un placeholder interno.
    // Xavier debe actualizar el email real en el perfil del proyecto.
    const placeholderEmail = `calculadora-${Date.now()}@pendiente.waas.internal`;

    // Buscar cliente existente por nombre de negocio (coincidencia exacta)
    const [existingClient] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.businessName, clientInput.businessName))
      .limit(1);

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const [newClient] = await db
        .insert(clients)
        .values({
          fullName: clientInput.clientName,
          email: placeholderEmail,
          businessName: clientInput.businessName,
          industry: clientInput.niche,
        })
        .returning({ id: clients.id });

      if (!newClient) throw new Error('No se pudo crear el cliente');
      clientId = newClient.id;
    }

    // ─── 2. Crear proyecto en DRAFT ───────────────────────
    const finalPrice = proposalData.calculation.finalClientPriceRounded;

    const [newProject] = await db
      .insert(projects)
      .values({
        clientId,
        plan: mapPlan(clientInput.projectType, clientInput.subscriptionPlan),
        // Para LEGACY: precio único como "mensual" × 1. Para suscripción: precio mensual real.
        monthlyPriceCents: Math.round(
          clientInput.projectType === 'legacy'
            ? finalPrice * 100
            : (proposalData.calculation.netSubtotal * 100)
        ),
        setupFeeCents: clientInput.includeSetupFee ? 5000 : 0,
        status: 'DRAFT',
        domainTarget: clientInput.domainTarget || null,
        // suggestedAddOns queda null en proyectos nuevos.
        // Las sugerencias comerciales vienen del snapshot de catálogo en la propuesta.
        suggestedAddOns: null,
        catalogSnapshot: proposalData.catalogSnapshot ?? null,
        internalNotes: [
          '📊 Proyecto creado desde Calculadora de Cotizaciones.',
          `💰 Total propuesto: $${finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `🔧 Neto Xavier: $${proposalData.calculation.providerNetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          existingClient ? '' : '⚠️ Email del cliente pendiente — actualizar en el perfil.',
        ].filter(Boolean).join('\n'),
        wizardBrief: clientInput.freeformBrief || null,
      })
      .returning({ id: projects.id });

    if (!newProject) throw new Error('No se pudo crear el proyecto');

    return { success: true, projectId: newProject.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear el proyecto',
    };
  }
}
