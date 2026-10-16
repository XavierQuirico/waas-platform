// on-subscription-cancelled: suspende proyecto + notifica cliente + alerta interna (el admin)
// Trigger: event 'waas/subscription.cancelled'
// Criterio: usamos SUSPENDED (no CANCELLED) — es reversible; El admin puede reactivar manualmente
// desde /admin/sitios si el cliente renueva o paga por otro medio.
// CANCELLED es terminal y destructivo — solo el admin lo aplica de forma manual y deliberada.

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients, projectEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { whatsappUrl } from '@/lib/config/contact';


export const onSubscriptionCancelled = inngest.createFunction(
  { id: 'waas-on-subscription-cancelled' },
  { event: 'waas/subscription.cancelled' },
  async ({ event, step }) => {
    const { projectId, subscriptionId } = event.data as {
      projectId: string;
      subscriptionId: string;
    };

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
          whatsapp: clients.whatsapp,
        })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      if (!client) throw new Error(`Client for project ${projectId} not found`);

      return { project, client };
    });

    const { project, client } = data;

    // Suspender proyecto si no está ya SUSPENDED o CANCELLED
    const previousStatus = project.status;
    if (previousStatus !== 'SUSPENDED' && previousStatus !== 'CANCELLED') {
      await step.run('suspend-project', async () => {
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
          fromStatus: previousStatus,
          toStatus: 'SUSPENDED' as const,
          metadata: { reason: 'subscription_cancelled', subscriptionId },
        });
      });
    }

    // Email al cliente — suscripción cancelada, sitio suspendido temporalmente
    await step.run('send-client-email', async () => {
      const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/facturacion`;
      const whatsappContact = whatsappUrl();

      await resend.emails.send({
        from: EMAIL_FROM,
        to: client.email,
        subject: `Tu suscripción fue cancelada — ${client.businessName}`,
        html: `
          <p>Hola ${client.fullName},</p>
          <p>Recibimos una notificación de PayPal indicando que la suscripción de <strong>${client.businessName}</strong> fue cancelada.</p>
          <p>Como resultado, tu sitio web ha sido <strong>suspendido temporalmente</strong>.</p>
          <p>Si esto fue un error o deseas reactivar tu sitio, tienes dos opciones:</p>
          <ul>
            <li><a href="${billingUrl}">Actualizar tu método de pago</a> desde el portal</li>
            <li><a href="${whatsappContact}">Contactarme directamente por WhatsApp</a> para coordinar</li>
          </ul>
          <p>Tu sitio y todos tus datos permanecen intactos. Solo necesitas reactivar la suscripción.</p>
          <br/>
          <p>— Xavier</p>
        `,
      });
    });

    // Alerta interna al admin
    await step.run('send-internal-alert', async () => {
      const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/sitios`;
      const adminProjectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/proyectos/${projectId}`;

      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `Suscripción cancelada — ${client.businessName} (${client.email})`,
        html: `
          <p><strong>Cliente:</strong> ${client.fullName} — ${client.businessName}</p>
          <p><strong>Email:</strong> ${client.email}</p>
          <p><strong>Proyecto ID:</strong> ${projectId}</p>
          <p><strong>Suscripción PayPal:</strong> ${subscriptionId}</p>
          <p><strong>Estado anterior:</strong> ${previousStatus}</p>
          <p><strong>Estado actual:</strong> SUSPENDED</p>
          <p>El cliente fue notificado por email. Puedes reactivar manualmente desde el panel:</p>
          <p><a href="${reviewUrl}">Ver todos los sitios →</a></p>
          <p><a href="${adminProjectUrl}">Ver proyecto específico →</a></p>
        `,
      });
    });
  }
);
