// on-payment-received: E01 + Clerk invitation + +30min E02
// Trigger: event 'waas/payment.received'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E01WelcomePayment from '@/emails/E01-welcome-payment';
import E02PortalUnlocked from '@/emails/E02-portal-unlocked';

export const onPaymentReceived = inngest.createFunction(
  { id: 'on-payment-received' },
  { event: 'waas/payment.received' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    // Obtener datos del proyecto + cliente
    const projectData = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({
          id: projects.id,
          plan: projects.plan,
          clientId: projects.clientId,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({ fullName: clients.fullName, email: clients.email, businessName: clients.businessName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      return { project, client };
    });

    const { project, client } = projectData;
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    // E01 — inmediatamente
    await step.run('send-E01', async () => {
      const html = render(
        E01WelcomePayment({
          clientName: client.fullName,
          businessName: client.businessName,
          plan: project.plan,
          portalUrl,
        })
      );
      await resend.emails.send({
        from: EMAIL_FROM,
        to: client.email,
        subject: `✓ Pago confirmado — ${client.businessName}`,
        html,
      });
    });

    // Transicionar a AWAITING_ASSETS
    await step.run('transition-to-awaiting-assets', async () => {
      // Solo avanza si el proyecto sigue en PAYMENT_RECEIVED: un evento repetido o
      // tardío no debe regresar un proyecto que ya está más adelante en el flujo.
      await db
        .update(projects)
        .set({ status: 'AWAITING_ASSETS' as const, updatedAt: new Date() })
        .where(and(eq(projects.id, projectId), eq(projects.status, 'PAYMENT_RECEIVED')));
    });

    // Esperar 30 minutos antes de E02
    await step.sleep('wait-30min', '30m');

    // E02 — portal desbloqueado
    await step.run('send-E02', async () => {
      const html = render(E02PortalUnlocked({ clientName: client.fullName, portalUrl }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: client.email,
        subject: `Tu portal está listo — ${client.businessName}`,
        html,
      });
    });
  }
);
