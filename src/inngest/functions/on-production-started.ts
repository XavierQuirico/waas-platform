// on-production-started: E11 + SLA reminders (24h, 12h, 2h → E15)
// Trigger: event 'waas/production.started'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E11ProductionStarted from '@/emails/E11-production-started';
import E15SlaWarningAdmin from '@/emails/E15-sla-warning-admin';

export const onProductionStarted = inngest.createFunction(
  { id: 'on-production-started' },
  { event: 'waas/production.started' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({ clientId: projects.clientId, productionDeadlineAt: projects.productionDeadlineAt })
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

    const deadline = data.project.productionDeadlineAt
      ? new Date(data.project.productionDeadlineAt).toLocaleDateString('es-DO', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
      : '72 horas hábiles';

    // E11 → cliente
    await step.run('send-E11', async () => {
      const html = render(E11ProductionStarted({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        deadline,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: '🔨 Tu sitio está en producción',
        html,
      });
    });

    // SLA warning 12h antes del deadline
    if (data.project.productionDeadlineAt) {
      const deadlineTs = new Date(data.project.productionDeadlineAt).getTime();
      const warningTs = deadlineTs - 12 * 60 * 60 * 1000;
      const now = Date.now();

      if (warningTs > now) {
        await step.sleepUntil('wait-until-sla-warning', new Date(warningTs).toISOString());

        await step.run('send-E15-sla-warning', async () => {
          const [current] = await db
            .select({ status: projects.status })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          if (current?.status !== 'PRODUCTION_STARTED') return;

          const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/proyectos/${projectId}`;
          const html = render(E15SlaWarningAdmin({
            clientName: data.client.fullName,
            businessName: data.client.businessName,
            deadline,
            hoursLeft: 12,
            reviewUrl,
          }));
          await resend.emails.send({
            from: EMAIL_FROM,
            to: process.env.ADMIN_EMAIL!,
            subject: `⚠ SLA en riesgo — 12h — ${data.client.businessName}`,
            html,
          });
        });
      }
    }
  }
);
