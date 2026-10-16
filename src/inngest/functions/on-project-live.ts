// on-project-live: E14 + schedules E17 (+7d) + E18 (+30d)
// Trigger: event 'waas/project.live'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E14LiveConfirmation from '@/emails/E14-live-confirmation';
import E17NpsDay7 from '@/emails/E17-nps-day7';
import E18NpsDay30 from '@/emails/E18-nps-day30';


export const onProjectLive = inngest.createFunction(
  { id: 'on-project-live' },
  { event: 'waas/project.live' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({ clientId: projects.clientId, productionUrl: projects.productionUrl, domainTarget: projects.domainTarget })
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

    // E14 — inmediatamente
    await step.run('send-E14', async () => {
      const html = render(E14LiveConfirmation({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        productionUrl: data.project.productionUrl ?? '',
        domainTarget: data.project.domainTarget ?? undefined,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: `🎉 ¡${data.client.businessName} está en vivo!`,
        html,
      });
    });

    // Esperar 7 días
    await step.sleep('wait-7d', '7d');

    // E17 — NPS día 7
    await step.run('send-E17', async () => {
      const html = render(E17NpsDay7({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        siteUrl: data.project.productionUrl ?? '',
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: '¿Cómo va todo con tu sitio?',
        html,
      });
    });

    // Esperar 23 días más (total: 30 días)
    await step.sleep('wait-23d-more', '23d');

    // E18 — NPS día 30
    await step.run('send-E18', async () => {
      const html = render(E18NpsDay30({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        siteUrl: data.project.productionUrl ?? '',
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: `Un mes con ${data.client.businessName} en vivo`,
        html,
      });
    });
  }
);
