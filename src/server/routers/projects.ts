// ============================================================
// tRPC Router — Projects (Client-facing mutations)
// Procedimientos: submitStagingFeedback, approveStagingAll
// Protección: IDOR via Clerk userId → clientId → projectId
// ============================================================

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';
import { db } from '@/db';
import { projects, clients, stagingFeedback, projectEvents, type StagingFeedbackItem } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { validateStagingChangesFeedback } from '@/lib/portal/staging-feedback-validation';

async function getClientProject(
  clerkUserId: string,
  projectId: string
): Promise<{ clientId: string } | null> {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clerkUserId, clerkUserId))
    .limit(1);

  if (!client) return null;

  const [project] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clientId, client.id)))
    .limit(1);

  if (!project) return null;

  return { clientId: client.id };
}

const stagingFeedbackItemSchema = z.object({
  section: z.string().min(1).max(100),
  status: z.enum(['approved', 'changes']),
  comment: z.string().max(2000).optional(),
});

export const projectsRouter = router({
  /**
   * El cliente envía feedback estructurado de la revisión de staging.
   * Al menos una sección con 'changes' → transiciona a REVISIONS.
   * Cada cambio debe tener comentario (validado client-side también).
   */
  submitStagingFeedback: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z.array(stagingFeedbackItemSchema).min(1).max(20),
        allApproved: z.literal(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cp = await getClientProject(ctx.userId, input.projectId);
      if (!cp) throw new Error('No autorizado.');

      const [project] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (project.status !== 'STAGING_REVIEW') {
        throw new Error('El proyecto no está en revisión de staging.');
      }

      validateStagingChangesFeedback(input.items as StagingFeedbackItem[]);

      const now = new Date();

      // Guardar feedback estructurado
      await db.insert(stagingFeedback).values({
        projectId: input.projectId,
        submittedAt: now,
        items: (input.items as StagingFeedbackItem[]),
        allApproved: false,
      });

      // Transicionar a REVISIONS
      await db
        .update(projects)
        .set({ status: 'REVISIONS' as const, updatedAt: now })
        .where(eq(projects.id, input.projectId));

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'staging_feedback_submitted' as const,
        actorType: 'client',
        actorId: ctx.userId,
        fromStatus: 'STAGING_REVIEW' as const,
        toStatus: 'REVISIONS' as const,
        metadata: { itemCount: input.items.length, revisionRequested: true },
      });

      // Disparar Inngest on-revisions-submitted → E13 (notifica al admin)
      await inngest.send({ name: 'waas/revisions.submitted', data: { projectId: input.projectId } });

      return { status: 'REVISIONS' };
    }),

  /**
   * El cliente aprueba todas las secciones del sitio sin cambios.
   * El proyecto permanece en STAGING_REVIEW — El admin publica desde admin con markLive.
   */
  approveStagingAll: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z.array(stagingFeedbackItemSchema).min(1).max(20),
        allApproved: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cp = await getClientProject(ctx.userId, input.projectId);
      if (!cp) throw new Error('No autorizado.');

      const [project] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) throw new Error('Proyecto no encontrado.');
      if (project.status !== 'STAGING_REVIEW') {
        throw new Error('El proyecto no está en revisión de staging.');
      }

      // Verificar server-side que TODAS están aprobadas
      const hasChanges = input.items.some((f) => f.status !== 'approved');
      if (hasChanges) {
        throw new Error('No todas las secciones están aprobadas.');
      }

      const now = new Date();

      // Guardar feedback de aprobación total
      await db.insert(stagingFeedback).values({
        projectId: input.projectId,
        submittedAt: now,
        items: (input.items as StagingFeedbackItem[]),
        allApproved: true,
      });

      // Registrar aprobación del cliente — el proyecto permanece en STAGING_REVIEW
      // La publicación real ocurre cuando el admin ejecuta markLive desde admin
      await db
        .update(projects)
        .set({ updatedAt: now })
        .where(eq(projects.id, input.projectId));

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'staging_feedback_submitted' as const,
        actorType: 'client',
        actorId: ctx.userId,
        fromStatus: 'STAGING_REVIEW' as const,
        toStatus: 'STAGING_REVIEW' as const,
        metadata: { allApproved: true, approvedByClient: true },
      });

      return { status: 'STAGING_REVIEW', approved: true };
    }),
});
