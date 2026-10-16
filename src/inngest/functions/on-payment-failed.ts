// on-payment-failed: gracia 3d → suspende + timestamps + R01 activation
// Trigger: event 'waas/payment.failed'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients, projectEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E16PaymentFailed from '@/emails/E16-payment-failed';


export const onPaymentFailed = inngest.createFunction(
  { id: 'waas-on-payment-failed' },
  { event: 'waas/payment.failed' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    // Obtener datos del proyecto + cliente
    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({
          id: projects.id,
          clientId: projects.clientId,
          status: projects.status,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({
          fullName: clients.fullName,
          email: clients.email,
          businessName: clients.businessName,
        })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      if (!client) throw new Error(`Client for project ${projectId} not found`);

      return { project, client };
    });

    const { client } = data;

    // Persistir fecha de fin de gracia antes de notificar al cliente
    const gracePeriodUntil = await step.run('persist-grace-period', async () => {
      const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await db
        .update(projects)
        .set({ paymentGracePeriodUntil: until, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
      return until.toISOString();
    });

    // E16 — email al cliente (pago fallido, 3 días de gracia)
    await step.run('send-E16-client', async () => {
      const gracePeriodEndsAt = new Date(gracePeriodUntil).toLocaleDateString(
        'es-DO',
        { weekday: 'long', day: 'numeric', month: 'long' }
      );
      const updatePaymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/facturacion`;

      const html = render(
        E16PaymentFailed({
          clientName: client.fullName,
          businessName: client.businessName,
          gracePeriodEndsAt,
          updatePaymentUrl,
        })
      );

      await resend.emails.send({
        from: EMAIL_FROM,
        to: client.email,
        subject: `Problema con tu pago — ${client.businessName}`,
        html,
      });
    });

    // Esperar 3 días de gracia antes de suspender (según contrato cláusula 7)
    await step.sleep('grace-period-3d', '3d');

    // Suspender si el cliente no regularizó el pago
    const suspended = await step.run('suspend-if-still-failed', async () => {
      const [current] = await db
        .select({
          status: projects.status,
          paymentGracePeriodUntil: projects.paymentGracePeriodUntil,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      // Si fue cancelado, cerrado o ya suspendido por otro mecanismo → skip
      if (!current || current.status === 'CANCELLED' || current.status === 'CLOSED' || current.status === 'SUSPENDED') {
        return false;
      }

      // paymentGracePeriodUntil === null significa que fue limpiado por un pago exitoso
      // durante el período de gracia → no suspender
      if (current.paymentGracePeriodUntil === null) {
        return false;
      }

      const preSuspensionStatus = current.status;
      const now = new Date();

      await db
        .update(projects)
        .set({
          status: 'SUSPENDED' as const,
          suspendedAt: now,
          paymentGracePeriodUntil: null,
          updatedAt: now,
        })
        .where(eq(projects.id, projectId));

      await db.insert(projectEvents).values({
        projectId,
        eventType: 'status_changed' as const,
        actorType: 'system',
        actorId: null,
        fromStatus: preSuspensionStatus,
        toStatus: 'SUSPENDED' as const,
        metadata: { reason: 'payment_failed_grace_period_expired' },
      });

      return true;
    });

    if (suspended) {
      // Alerta interna al admin
      await step.run('send-internal-alert', async () => {
        const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/proyectos/${projectId}`;

        await resend.emails.send({
          from: EMAIL_FROM,
          to: process.env.ADMIN_EMAIL!,
          subject: `Pago fallido — ${client.businessName} (${client.email})`,
          html: `
            <p><strong>Cliente:</strong> ${client.fullName} — ${client.businessName}</p>
            <p><strong>Email:</strong> ${client.email}</p>
            <p><strong>Proyecto:</strong> ${projectId}</p>
            <p><strong>Estado actual:</strong> SUSPENDED</p>
            <p><a href="${reviewUrl}">Ver proyecto en el admin →</a></p>
          `,
        });
      });

      // Activar R01 si el proyecto sigue suspendido 11 días después de la suspensión.
      // Día 4 (suspensión) + 11d = día 15 desde el fallo de pago original.
      // R01 NUNCA se activa antes del día 15 total desde el fallo.
      await step.sleep('activate-r01-after-11d', '11d');

      await step.run('activate-r01-if-still-suspended', async () => {
        const [current] = await db
          .select({ status: projects.status })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (!current || current.status !== 'SUSPENDED') return;

        await db
          .update(projects)
          .set({ reactivationFeeActive: true, updatedAt: new Date() })
          .where(eq(projects.id, projectId));
      });
    }
  }
);
