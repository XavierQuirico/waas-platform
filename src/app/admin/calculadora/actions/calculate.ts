'use server';
// ============================================================
// Server Action — Cálculo Determinístico + Guardar en DB
// 100% matemático, sin IA. Fuente: formulas.ts
// saveQuoteAction auto-computa catalogSnapshot desde el loader.
// ============================================================

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { quotes, type NewQuote } from '@/db/schema/quotes';
import { calculateQuote, calcStagingDeadline } from '@/lib/calculadora/formulas';
import { renderProposalHtml } from '@/lib/calculadora/proposal-template';
import { getCatalogSnapshotForProposal } from '@/lib/catalog/catalog-loader';
import { isAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/admin/auth';
import type {
  ClientContextInput,
  AdjustmentsInput,
  CalculationResult,
  ProposalData,
} from '@/lib/calculadora/types';
import type { SubscriptionPlan } from '@/lib/catalog/types';

// ─── Tipos de respuesta ───────────────────────────────────
export type CalculateActionResult =
  | { success: true; calculation: CalculationResult; proposalData: ProposalData }
  | { success: false; error: string; alerts?: string[] };

export type SaveQuoteActionResult =
  | { success: true; quoteId: string }
  | { success: false; error: string };

// ─── Action: Calcular cotización ──────────────────────────
export async function calculateQuoteAction(
  clientInput: ClientContextInput,
  adjustments: AdjustmentsInput,
  executiveSummary: string
): Promise<CalculateActionResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    // Ejecutar cálculo determinístico
    const calculation = calculateQuote(clientInput, adjustments);

    // Calcular fechas
    const now = new Date();
    const startDate = adjustments.startDate ?? now;
    const stagingDeadline = adjustments.stagingDate
      ? new Date(adjustments.stagingDate)
      : calcStagingDeadline(startDate);
    const finalDelivery = adjustments.deliveryDate
      ? new Date(adjustments.deliveryDate)
      : new Date(stagingDeadline.getTime() + 4 * 24 * 60 * 60 * 1000); // +4 días revisión cliente

    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + (adjustments.proposalValidityDays ?? 7));

    // generar snapshot del catálogo comercial.
    const planForSnapshot = clientInput.subscriptionPlan?.toUpperCase() as SubscriptionPlan | undefined;
    let catalogSnapshot = null;
    if (planForSnapshot && ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'].includes(planForSnapshot)) {
      catalogSnapshot = await getCatalogSnapshotForProposal(planForSnapshot).catch(() => null);
    }

    // Construir datos de la propuesta
    const proposalData: ProposalData = {
      clientName: clientInput.clientName,
      businessName: clientInput.businessName,
      niche: clientInput.niche,
      projectType: clientInput.projectType,
      createdAt: now,
      validUntil,
      executiveSummary,
      calculation,
      paymentStructure: adjustments.paymentStructure,
      startDateEstimate: startDate.toLocaleDateString('es-DO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      stagingDeadline: stagingDeadline.toLocaleDateString('es-DO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      finalDeliveryEstimate: finalDelivery.toLocaleDateString('es-DO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      subscriptionPlan: clientInput.subscriptionPlan,
      status: 'draft',
      internalNotes: adjustments.internalNotes,
      ...(catalogSnapshot != null ? { catalogSnapshot } : {}),
    };

    return { success: true, calculation, proposalData };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: `Error en el cálculo: ${msg}` };
  }
}

// ─── Action: Guardar cotización en Neon DB ────────────────
// el catalogSnapshot se computa server-side automáticamente.
// El cliente no necesita pasarlo — se deriva de clientInput.subscriptionPlan.
export async function saveQuoteAction(
  clientInput: ClientContextInput,
  adjustments: AdjustmentsInput,
  proposalData: ProposalData
): Promise<SaveQuoteActionResult> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    const proposalHtml = await renderProposalHtml(proposalData);

    // generar snapshot del catálogo comercial al guardar la cotización.
    // (Ahora se hace en calculateQuoteAction y viene en proposalData)
    const quoteValues = {
      clientName: clientInput.clientName,
      businessName: clientInput.businessName,
      projectType: clientInput.projectType,
      niche: clientInput.niche,
      domainTarget: clientInput.domainTarget,
      clientEmail: clientInput.clientEmail ?? null,
      clientPhone: clientInput.clientPhone ?? null,
      status: 'draft',
      totalAmountClient:
        adjustments.paymentStructure === 'installments'
          ? (proposalData.calculation.installments?.totalClientPays ?? 0)
          : proposalData.calculation.finalClientPriceRounded,
      totalAmountProvider: proposalData.calculation.providerNetAmount,
      discountPercent: proposalData.calculation.finalDiscountPercent * 100,
      discountReason: adjustments.exceptionDiscountReason ?? null,
      componentsSnapshot: adjustments.selectedComponents as object[],
      calculationSnapshot: proposalData.calculation as unknown as object,
      proposalHtml,
      executiveSummary: proposalData.executiveSummary,
      subscriptionPlan: clientInput.subscriptionPlan ?? null,
      validUntil: proposalData.validUntil,
      // catalog snapshot preserva el estado comercial en el momento de cotizar.
      ...(proposalData.catalogSnapshot != null ? { catalogSnapshot: proposalData.catalogSnapshot } : {}),
    } as NewQuote;
    const [inserted] = await db
      .insert(quotes)
      .values(quoteValues)
      .returning({ id: quotes.id });

    return { success: true, quoteId: inserted.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: `Error al guardar la cotización: ${msg}` };
  }
}

// ─── Action: Actualizar estado de una cotización ──────────
export async function updateQuoteStatusAction(
  quoteId: string,
  status: 'sent' | 'accepted' | 'rejected' | 'expired'
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) return { success: false, error: UNAUTHORIZED_MESSAGE };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.update(quotes).set({
      status,
      ...(status === 'sent' ? { sentAt: new Date() } : {}),
      updatedAt: new Date(),
    }).where(eq(quotes.id, quoteId));

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, error: msg };
  }
}
