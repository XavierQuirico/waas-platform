// ============================================================
// tRPC Router — Admin WaaS (Solo el admin)
// Procedimientos: sendProposal, reviewAsset, startProduction,
//                 deployToStaging, markLive, addInternalNote
// Protección: verifica ADMIN_CLERK_USER_ID en cada procedimiento
// ============================================================

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';
import { db } from '@/db';
import { projects, projectAssets, projectEvents, admins, holidaysRd } from '@/db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { canTransition, type ProjectStatus } from '@/lib/projects/state-machine';
import {
  calculateProductionDeadline,
  calculateStagingReviewDeadline,
  getHolidaysFromDB,
} from '@/lib/sla/business-hours';
import { ASSET_REQUIREMENTS } from '@/lib/assets/asset-requirements';
import { inngest } from '@/inngest/client';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

async function assertAdmin(userId: string) {
  if (userId !== ADMIN_CLERK_USER_ID) {
    throw new Error('No autorizado (Variable de entorno).');
  }
  
  // VULN-01: Doble verificación con base de datos
  const [adminRecord] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);
    
  if (!adminRecord) {
    throw new Error('No autorizado (Base de datos).');
  }
}

// Solo https: evita esquemas como javascript: o http: en enlaces que luego se muestran al cliente.
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.toLowerCase().startsWith('https://'), 'La URL debe usar https.');

async function loadProjectStatus(projectId: string) {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) throw new Error('Proyecto no encontrado.');
  return project.status;
}

function assertCanTransition(from: ProjectStatus, to: ProjectStatus, action: string) {
  if (!canTransition(from, to)) {
    throw new Error(`No se puede ${action} desde el estado: ${from}`);
  }
}

// La actualización se condiciona al estado leído: si otra operación cambió el
// proyecto entre la lectura y la escritura, no se pisa con una transición inválida.
function assertStateUnchanged(updatedRows: unknown[]) {
  if (updatedRows.length === 0) {
    throw new Error('El estado del proyecto cambió mientras se procesaba. Recarga e intenta de nuevo.');
  }
}

export const adminRouter = router({
  /**
   * El admin envía la propuesta personalizada al cliente.
   * Transiciona DRAFT → PROPOSAL_SENT y registra proposalExpiresAt (+7 días).
   * Dispara Inngest: on-proposal-sent → E03 + schedules E04(d3), E05(d7), expiry.
   */
  sendProposal: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        personalNote: z.string().max(2000).optional(),
        selectedAddOns: z.array(z.string()).default([]),
        internalNotes: z.string().max(2000).optional(),
        snapshotSource: z.enum(['project_snapshot', 'quote_snapshot', 'live_fallback', 'legacy_none']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [projectRow] = await db
        .select({
          status: projects.status,
          catalogSnapshot: projects.catalogSnapshot
        })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!projectRow) throw new Error('Proyecto no encontrado.');

      // Validar add-ons seleccionados contra el snapshot (si existe) y calcular total
      let calculatedAddOnTotalCents = 0;
      if (projectRow.catalogSnapshot && input.selectedAddOns.length > 0) {
        const allowedCodes = projectRow.catalogSnapshot.recommendedAddOns.map(a => a.code);
        const invalid = input.selectedAddOns.find(c => !allowedCodes.includes(c));
        if (invalid) {
          throw new Error(`Add-on seleccionado inválido o no existe en el snapshot: ${invalid}`);
        }
        calculatedAddOnTotalCents = input.selectedAddOns.reduce((sum, code) => {
          const addon = projectRow.catalogSnapshot!.recommendedAddOns.find(a => a.code === code);
          return sum + (addon?.priceCents || 0);
        }, 0);
      }

      const [updated] = await db
        .update(projects)
        .set({
          status: 'PROPOSAL_SENT' as const,
          proposalSentAt: now,
          proposalExpiresAt: expiresAt,
          // suggestedAddOns deprecado. No se repopula al enviar propuesta.
          // Las sugerencias comerciales viven en el catalogSnapshot de la propuesta.
          suggestedAddOns: null,
          internalNotes: input.internalNotes ?? null,
          updatedAt: now,
        })
        .where(
          and(
            eq(projects.id, input.projectId),
            inArray(projects.status, ['DRAFT', 'REQUIRES_REVIEW'])
          )
        )
        .returning({ id: projects.id, status: projects.status });

      if (!updated) throw new Error('Estado de proyecto incorrecto para enviar propuesta.');

      // Registrar evento
      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'proposal_sent' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: 'DRAFT' as const,
        toStatus: 'PROPOSAL_SENT' as const,
        metadata: {
          personalNote: input.personalNote,
          selectedAddOns: input.selectedAddOns,
          snapshotSource: input.snapshotSource,
          calculatedAddOnTotalCents
        },
      });

      await inngest.send({
        name: 'waas/proposal.sent',
        data: { projectId: input.projectId },
      });

      return { status: updated.status };
    }),

  /**
   * El admin aprueba o rechaza un asset individual.
   * Si rechaza, el comentario es obligatorio.
   */
  reviewAsset: protectedProcedure
    .input(
      z.object({
        assetId: z.string().uuid(),
        action: z.enum(['approved', 'rejected']),
        comment: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      if (input.action === 'rejected' && !input.comment?.trim()) {
        throw new Error('El comentario es obligatorio al rechazar un asset.');
      }

      const [updated] = await db
        .update(projectAssets)
        .set({
          status: input.action,
          reviewedAt: new Date(),
          reviewedBy: ctx.userId,
          rejectionComment: input.action === 'rejected' ? input.comment : null,
          updatedAt: new Date(),
        })
        .where(eq(projectAssets.id, input.assetId))
        .returning();

      if (!updated) throw new Error('Asset no encontrado.');

      // Registrar evento
      await db.insert(projectEvents).values({
        projectId: updated.projectId,
        eventType: input.action === 'approved' ? 'asset_approved' as const : 'asset_rejected' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        assetKey: updated.assetKey,
        metadata: { comment: input.comment },
      });

      // Verificar si todos los assets requeridos del proyecto tienen estado 'rejected'
      // para transicionar a ASSETS_INCOMPLETE (si hay alguno rechazado)
      const [project] = await db
        .select({ plan: projects.plan, status: projects.status })
        .from(projects)
        .where(eq(projects.id, updated.projectId))
        .limit(1);

      if (project?.status === 'ASSETS_UNDER_REVIEW') {

        if (input.action === 'rejected') {
          // Transicionar a ASSETS_INCOMPLETE si hay rechazos
          await db
            .update(projects)
            .set({ status: 'ASSETS_INCOMPLETE' as const, updatedAt: new Date() })
            .where(eq(projects.id, updated.projectId));

          await inngest.send({
            name: 'waas/assets.incomplete',
            data: { projectId: updated.projectId },
          });
        }
      }

      return { asset: updated };
    }),

  /**
   * El admin inicia la producción de 72h.
   * Solo disponible cuando TODOS los assets requeridos están 'approved'.
   * Calcula productionDeadlineAt usando el motor de horas hábiles.
   */
  startProduction: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const [project] = await db
        .select({ status: projects.status, plan: projects.plan })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (!canTransition(project.status, 'PRODUCTION_STARTED')) {
        throw new Error(`No se puede iniciar producción desde estado: ${project.status}`);
      }

      // Verificar server-side que TODOS los assets requeridos están aprobados
      const plan = project.plan as 'BASIC' | 'PRO' | 'BUSINESS';
      const requirements = ASSET_REQUIREMENTS[plan] ?? ASSET_REQUIREMENTS.BASIC;
      const requiredKeys = requirements.filter((r) => r.required).map((r) => r.key);

      const assets = await db
        .select({ assetKey: projectAssets.assetKey, status: projectAssets.status })
        .from(projectAssets)
        .where(eq(projectAssets.projectId, input.projectId));

      const allApproved = requiredKeys.every((key) => {
        const req = requirements.find((r) => r.key === key)!;
        if (req.minCount) {
          const approvedCount = assets.filter(
            (a) => a.assetKey === key && a.status === 'approved'
          ).length;
          return approvedCount >= req.minCount;
        }
        return assets.some((a) => a.assetKey === key && a.status === 'approved');
      });

      if (!allApproved) {
        throw new Error(
          'No se puede iniciar producción: hay assets requeridos sin aprobar.'
        );
      }

      const now = new Date();
      const holidays = await getHolidaysFromDB();
      const deadline = calculateProductionDeadline(now, holidays);

      await db
        .update(projects)
        .set({
          status: 'PRODUCTION_STARTED' as const,
          productionStartedAt: now,
          productionDeadlineAt: deadline,
          updatedAt: now,
        })
        .where(eq(projects.id, input.projectId));

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'production_started' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: 'ASSETS_UNDER_REVIEW' as const,
        toStatus: 'PRODUCTION_STARTED' as const,
        metadata: { deadline: deadline.toISOString() },
      });

      await inngest.send({
        name: 'waas/production.started',
        data: { projectId: input.projectId },
      });

      return { status: 'PRODUCTION_STARTED', deadline };
    }),

  /**
   * El admin despliega el sitio a staging y registra la URL.
   */
  deployToStaging: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        stagingUrl: httpsUrl,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const fromStatus = await loadProjectStatus(input.projectId);
      assertCanTransition(fromStatus, 'STAGING_REVIEW', 'desplegar a staging');

      const now = new Date();
      const holidays = await getHolidaysFromDB();
      const reviewDeadline = calculateStagingReviewDeadline(now, holidays);

      const updated = await db
        .update(projects)
        .set({
          status: 'STAGING_REVIEW' as const,
          stagingUrl: input.stagingUrl,
          stagingDeployedAt: now,
          stagingReviewDeadlineAt: reviewDeadline,
          updatedAt: now,
        })
        .where(and(eq(projects.id, input.projectId), eq(projects.status, fromStatus)))
        .returning({ id: projects.id });
      assertStateUnchanged(updated);

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'staging_deployed' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: fromStatus,
        toStatus: 'STAGING_REVIEW' as const,
        metadata: { stagingUrl: input.stagingUrl },
      });

      await inngest.send({
        name: 'waas/staging.deployed',
        data: { projectId: input.projectId },
      });

      return { status: 'STAGING_REVIEW', reviewDeadline };
    }),

  /**
   * El admin marca el sitio como en vivo.
   */
  markLive: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        productionUrl: httpsUrl,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const fromStatus = await loadProjectStatus(input.projectId);
      assertCanTransition(fromStatus, 'LIVE', 'publicar el sitio');

      const now = new Date();

      const updated = await db
        .update(projects)
        .set({
          status: 'LIVE' as const,
          productionUrl: input.productionUrl,
          liveAt: now,
          updatedAt: now,
        })
        .where(and(eq(projects.id, input.projectId), eq(projects.status, fromStatus)))
        .returning({ id: projects.id });
      assertStateUnchanged(updated);

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'status_changed' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: fromStatus,
        toStatus: 'LIVE' as const,
        metadata: { productionUrl: input.productionUrl },
      });

      await inngest.send({
        name: 'waas/project.live',
        data: { projectId: input.projectId },
      });

      return { status: 'LIVE' };
    }),

  /**
   * El admin agrega una nota interna al proyecto (nunca visible al cliente).
   */
  addInternalNote: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        note: z.string().max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      await db
        .update(projects)
        .set({
          internalNotes: input.note,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, input.projectId));

      return { ok: true };
    }),

  /**
   * El admin suspende manualmente un proyecto LIVE (por incumplimiento, fraude, etc.)
   * LIVE → SUSPENDED
   */
  suspendProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const [project] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (project.status === 'SUSPENDED') throw new Error('El proyecto ya está suspendido.');
      if (project.status === 'CANCELLED') throw new Error('No se puede suspender un proyecto cancelado.');
      // Solo un sitio publicado se suspende; la máquina de estados no permite otras rutas.
      assertCanTransition(project.status, 'SUSPENDED', 'suspender el proyecto');

      const now = new Date();

      const updated = await db
        .update(projects)
        .set({
          status: 'SUSPENDED' as const,
          suspendedAt: now,
          paymentGracePeriodUntil: null,
          reactivationFeeActive: false,
          updatedAt: now,
        })
        .where(and(eq(projects.id, input.projectId), eq(projects.status, project.status)))
        .returning({ id: projects.id });
      assertStateUnchanged(updated);

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'status_changed' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: project.status,
        toStatus: 'SUSPENDED' as const,
        metadata: { reason: input.reason ?? 'Suspensión manual por Xavier', manual: true },
      });

      return { status: 'SUSPENDED' };
    }),

  /**
   * El admin reactiva manualmente un proyecto SUSPENDED.
   * SUSPENDED → LIVE
   */
  reactivateProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const [project] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (project.status !== 'SUSPENDED') {
        throw new Error('Solo se pueden reactivar proyectos suspendidos.');
      }

      const now = new Date();

      const updated = await db
        .update(projects)
        .set({
          status: 'LIVE' as const,
          suspendedAt: null,
          paymentGracePeriodUntil: null,
          reactivationFeeActive: false,
          updatedAt: now,
        })
        .where(and(eq(projects.id, input.projectId), eq(projects.status, 'SUSPENDED')))
        .returning({ id: projects.id });
      assertStateUnchanged(updated);

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'status_changed' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: 'SUSPENDED' as const,
        toStatus: 'LIVE' as const,
        metadata: { reason: 'Reactivación manual por Xavier', manual: true },
      });

      return { status: 'LIVE' };
    }),

  /**
   * El admin marca las revisiones como completadas.
   * REVISIONS → REVISIONS_DONE
   */
  markRevisionsDone: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const [project] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (!canTransition(project.status, 'REVISIONS_DONE')) {
        throw new Error(
          `No se puede marcar revisiones como completadas desde estado: ${project.status}`
        );
      }

      const now = new Date();

      await db
        .update(projects)
        .set({ status: 'REVISIONS_DONE' as const, updatedAt: now })
        .where(eq(projects.id, input.projectId));

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'status_changed' as const,
        actorType: 'admin',
        actorId: ctx.userId,
        fromStatus: 'REVISIONS' as const,
        toStatus: 'REVISIONS_DONE' as const,
        metadata: {},
      });

      return { status: 'REVISIONS_DONE' };
    }),

  /**
   * Lista todos los feriados RD ordenados por fecha.
   */
  listHolidays: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.userId);
    return db.select().from(holidaysRd).orderBy(asc(holidaysRd.date));
  }),

  /**
   * Añade un nuevo feriado RD.
   */
  addHoliday: protectedProcedure
    .input(z.object({ date: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);
      const year = new Date(input.date).getFullYear();
      await db.insert(holidaysRd).values({
        id: crypto.randomUUID(),
        date: input.date,
        name: input.name,
        year,
      });
      return { ok: true };
    }),

  /**
   * Elimina un feriado RD por id.
   */
  deleteHoliday: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);
      await db.delete(holidaysRd).where(eq(holidaysRd.id, input.id));
      return { ok: true };
    }),
});
