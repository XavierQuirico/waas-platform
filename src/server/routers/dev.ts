// ============================================================
// tRPC Router — Dev Tools (SOLO en NODE_ENV=development)
// Permite simular cualquier escenario sin tocar la DB de prod
// ============================================================

import { z } from 'zod';
import { protectedProcedure, router } from '@/server/trpc';
import { db } from '@/db';
import {
  clients,
  projects,
  projectAssets,
  projectEvents,
  incidents,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { inngest } from '@/inngest/client';
import { PLAN_MONTHLY_PRICE_CENTS } from '@/lib/paypal/plans';
import { assetKeyEnum } from '@/db/schema/project-assets';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

function assertAdminDev(userId: string) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev tools solo disponibles en desarrollo.');
  }
  if (userId !== ADMIN_CLERK_USER_ID) {
    throw new Error('No autorizado.');
  }
}

const PROJECT_STATUSES = [
  'DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED',
  'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE',
  'SUSPENDED', 'CANCELLED',
] as const;

export const devRouter = router({
  /**
   * Crea un cliente de prueba con proyecto en el estado indicado.
   */
  createTestData: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(2),
        email: z.string().email(),
        businessName: z.string().min(2),
        plan: z.enum(['BASIC', 'PRO', 'BUSINESS', 'LEGACY']),
        status: z.enum(PROJECT_STATUSES),
        stagingUrl: z.string().url().optional(),
        productionUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      // Crear o reutilizar cliente por email
      const existingClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.email, input.email))
        .limit(1);

      let clientId: string;

      if (existingClient[0]) {
        clientId = existingClient[0].id;
      } else {
        const [newClient] = await db
          .insert(clients)
          .values({
            clerkUserId: `dev_${randomUUID()}`,
            fullName: input.clientName,
            email: input.email,
            whatsapp: '+18095550000',
            businessName: input.businessName,
            industry: 'gastronomia',
            location: 'Santo Domingo',
            materialStatus: 'tiene_todo',
          })
          .returning({ id: clients.id });
        clientId = newClient.id;
      }

      const [project] = await db
        .insert(projects)
        .values({
          clientId,
          plan: input.plan,
          status: input.status,
          monthlyPriceCents: PLAN_MONTHLY_PRICE_CENTS[input.plan as keyof typeof PLAN_MONTHLY_PRICE_CENTS] ?? 0,
          setupFeeCents: 5000,
          stagingUrl: input.stagingUrl ?? null,
          productionUrl: input.productionUrl ?? null,
          intakeSnapshot: {
            fullName: input.clientName,
            email: input.email,
            whatsapp: '+18095550000',
            businessName: input.businessName,
            industry: 'gastronomia',
            location: 'Santo Domingo',
            materialStatus: 'tiene_todo',
          },
        })
        .returning({ id: projects.id });

      await db.insert(projectEvents).values({
        projectId: project.id,
        eventType: 'status_changed' as const,
        actorType: 'system',
        fromStatus: 'DRAFT' as const,
        toStatus: input.status,
        metadata: { source: 'dev_panel', createdBy: ctx.userId },
      });

      return { projectId: project.id, clientId, status: input.status };
    }),

  /**
   * Avanza el estado de un proyecto sin validar la state machine.
   * Solo para testing.
   */
  advanceProjectState: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        newStatus: z.enum(PROJECT_STATUSES),
        stagingUrl: z.string().url().optional(),
        productionUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      const [prev] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!prev) throw new Error('Proyecto no encontrado.');

      const updates: Record<string, unknown> = {
        status: input.newStatus,
        updatedAt: new Date(),
      };

      if (input.stagingUrl) updates.stagingUrl = input.stagingUrl;
      if (input.productionUrl) updates.productionUrl = input.productionUrl;
      if (input.newStatus === 'LIVE') updates.liveAt = new Date();

      await db
        .update(projects)
        .set(updates)
        .where(eq(projects.id, input.projectId));

      await db.insert(projectEvents).values({
        projectId: input.projectId,
        eventType: 'status_changed' as const,
        actorType: 'system',
        actorId: ctx.userId,
        fromStatus: prev.status,
        toStatus: input.newStatus,
        metadata: { source: 'dev_panel_manual' },
      });

      return { projectId: input.projectId, newStatus: input.newStatus };
    }),

  /**
   * Crea assets fake en projectAssets sin subir a R2.
   */
  createFakeAssets: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetKeys: z.array(z.enum(assetKeyEnum.enumValues)).min(1),
        status: z.enum(['uploaded', 'approved', 'rejected']).default('uploaded'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      const assetData = input.assetKeys.map((key, i) => ({
        projectId: input.projectId,
        assetKey: key,
        r2Key: `projects/${input.projectId}/assets/${key}/dev-fake-${i}.jpg`,
        originalName: `dev-fake-${key}.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 100000,
        fileIndex: key === 'photos' ? i : 0,
        status: input.status,
      }));

      await db.insert(projectAssets).values(assetData).onConflictDoNothing();

      return { created: assetData.length };
    }),

  /**
   * Simula un webhook de PayPal en el handler real.
   */
  simulatePaypalWebhook: protectedProcedure
    .input(
      z.object({
        eventType: z.enum([
          'BILLING.SUBSCRIPTION.ACTIVATED',
          'PAYMENT.CAPTURE.COMPLETED',
          'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
          'BILLING.SUBSCRIPTION.CANCELLED',
        ]),
        projectId: z.string().uuid().optional(),
        subscriptionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      const mockPayload = {
        id: `dev-event-${randomUUID()}`,
        event_type: input.eventType,
        resource: {
          id: input.subscriptionId ?? `I-dev${Date.now()}`,
          status: 'ACTIVE',
          plan_id: 'P-dev-plan',
          subscriber: { email_address: 'dev@waas.test' },
          billing_info: { outstanding_balance: { value: '0', currency_code: 'USD' } },
        },
        create_time: new Date().toISOString(),
      };

      // Llama al endpoint directamente
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const res = await fetch(`${baseUrl}/api/webhooks/paypal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Bypass': 'true', // El handler lo reconoce en dev
        },
        body: JSON.stringify(mockPayload),
      });

      return { status: res.status, eventType: input.eventType };
    }),

  /**
   * Dispara un evento Inngest manualmente.
   */
  triggerInngestEvent: protectedProcedure
    .input(
      z.object({
        eventName: z.string(),
        data: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      await inngest.send({ name: input.eventName, data: input.data });
      return { sent: true, eventName: input.eventName };
    }),

  /**
   * Retorna los últimos 50 projectEvents de proyectos creados desde el panel dev.
   */
  getRecentEvents: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      const baseQuery = db
        .select({
          id: projectEvents.id,
          projectId: projectEvents.projectId,
          eventType: projectEvents.eventType,
          actorType: projectEvents.actorType,
          fromStatus: projectEvents.fromStatus,
          toStatus: projectEvents.toStatus,
          metadata: projectEvents.metadata,
          createdAt: projectEvents.createdAt,
        })
        .from(projectEvents)
        .orderBy(desc(projectEvents.createdAt))
        .limit(50);

      const events = input.projectId
        ? await baseQuery.where(eq(projectEvents.projectId, input.projectId))
        : await baseQuery;
      return events;
    }),

  /**
   * Lista todos los proyectos (para el selector del panel dev).
   */
  listAllProjects: protectedProcedure
    .query(async ({ ctx }) => {
      assertAdminDev(ctx.userId);

      const rows = await db
        .select({
          id: projects.id,
          plan: projects.plan,
          status: projects.status,
          businessName: clients.businessName,
          email: clients.email,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .orderBy(desc(projects.createdAt))
        .limit(50);

      return rows;
    }),

  /**
   * Elimina proyectos e incidencias creados desde el panel dev.
   * Solo elimina los que tienen fuente dev_panel en su primer event.
   */
  cleanDevData: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertAdminDev(ctx.userId);

      // Eliminar en orden: events, assets, incidents, projects
      await db.delete(projectEvents).where(eq(projectEvents.projectId, input.projectId));
      await db.delete(projectAssets).where(eq(projectAssets.projectId, input.projectId));
      await db.delete(incidents).where(eq(incidents.projectId, input.projectId));
      await db.delete(projects).where(eq(projects.id, input.projectId));

      return { deleted: true, projectId: input.projectId };
    }),
});
