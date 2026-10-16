// ============================================================
// tRPC Router — Incidents (Cliente + Admin)
// Procedimientos cliente: reportIncident, getIncidents, getSiteStatus
// Procedimientos admin: getAllOpenIncidents, resolveIncident
// ============================================================

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';
import { db } from '@/db';
import { incidents, projects, clients, admins } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

async function assertAdmin(userId: string) {
  if (userId !== ADMIN_CLERK_USER_ID) {
    throw new Error('No autorizado (Variable de entorno).');
  }
  const [adminRecord] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);
  if (!adminRecord) {
    throw new Error('No autorizado (Base de datos).');
  }
}

async function getClientProject(clerkUserId: string, projectId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clerkUserId, clerkUserId))
    .limit(1);
  if (!client) return null;

  const [project] = await db
    .select({ id: projects.id, productionUrl: projects.productionUrl, status: projects.status })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clientId, client.id)))
    .limit(1);
  if (!project) return null;

  return { clientId: client.id, project };
}

export const incidentsRouter = router({
  // ─── Client procedures ──────────────────────────────────

  reportIncident: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(5).max(200),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cp = await getClientProject(ctx.userId, input.projectId);
      if (!cp) throw new Error('No autorizado.');

      const [incident] = await db
        .insert(incidents)
        .values({
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          status: 'OPEN',
          reportedBy: 'CLIENT',
        })
        .returning();

      await inngest.send({
        name: 'waas/incident.reported',
        data: {
          projectId: input.projectId,
          incidentId: incident.id,
          title: input.title,
        },
      });

      return { incident };
    }),

  getIncidents: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cp = await getClientProject(ctx.userId, input.projectId);
      if (!cp) throw new Error('No autorizado.');

      const result = await db
        .select()
        .from(incidents)
        .where(eq(incidents.projectId, input.projectId))
        .orderBy(desc(incidents.createdAt))
        .limit(50);

      return result;
    }),

  getSiteStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cp = await getClientProject(ctx.userId, input.projectId);
      if (!cp) throw new Error('No autorizado.');

      const openIncidents = await db
        .select({ id: incidents.id, title: incidents.title, createdAt: incidents.createdAt })
        .from(incidents)
        .where(
          and(
            eq(incidents.projectId, input.projectId),
            inArray(incidents.status, ['OPEN', 'IN_PROGRESS'])
          )
        )
        .orderBy(desc(incidents.createdAt));

      const hasActiveIncidents = openIncidents.length > 0;

      return {
        status: hasActiveIncidents ? 'degraded' as const : 'operational' as const,
        projectStatus: cp.project.status,
        productionUrl: cp.project.productionUrl,
        openIncidents,
      };
    }),

  // ─── Admin procedures ───────────────────────────────────

  getAllOpenIncidents: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx.userId);

    const result = await db
      .select({
        id: incidents.id,
        projectId: incidents.projectId,
        title: incidents.title,
        description: incidents.description,
        status: incidents.status,
        reportedBy: incidents.reportedBy,
        createdAt: incidents.createdAt,
        updatedAt: incidents.updatedAt,
      })
      .from(incidents)
      .where(inArray(incidents.status, ['OPEN', 'IN_PROGRESS']))
      .orderBy(desc(incidents.createdAt))
      .limit(100);

    return result;
  }),

  resolveIncident: protectedProcedure
    .input(
      z.object({
        incidentId: z.string().uuid(),
        resolvedNote: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.userId);

      const [updated] = await db
        .update(incidents)
        .set({
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedNote: input.resolvedNote ?? 'Resuelto por administrador.',
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, input.incidentId))
        .returning();

      if (!updated) throw new Error('Incidencia no encontrada.');

      await inngest.send({
        name: 'waas/incident.resolved',
        data: {
          projectId: updated.projectId,
          incidentId: updated.id,
          autoResolved: false,
        },
      });

      return { incident: updated };
    }),
});
