// on-assets-incomplete: E08 + schedules E09 (d4) + E10 (d8)
// Trigger: event 'waas/assets.incomplete'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients, projectAssets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E08AssetsIncomplete from '@/emails/E08-assets-incomplete';
import E09AssetsIncompleteD4 from '@/emails/E09-assets-incomplete-d4';
import E10AssetsIncompleteD8 from '@/emails/E10-assets-incomplete-d8';


export const onAssetsIncomplete = inngest.createFunction(
  { id: 'on-assets-incomplete' },
  { event: 'waas/assets.incomplete' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({ id: projects.id, clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({ fullName: clients.fullName, email: clients.email, businessName: clients.businessName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      // Obtener assets rechazados
      const rejected = await db
        .select({ assetKey: projectAssets.assetKey, rejectionComment: projectAssets.rejectionComment })
        .from(projectAssets)
        .where(eq(projectAssets.projectId, projectId));

      const rejectedAssets = rejected
        .filter((a) => a.rejectionComment)
        .map((a) => ({ label: a.assetKey, comment: a.rejectionComment! }));

      return { project, client, rejectedAssets };
    });

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/assets`;

    // E08 — inmediatamente
    await step.run('send-E08', async () => {
      const html = render(E08AssetsIncomplete({
        clientName: data.client.fullName,
        rejectedAssets: (data.rejectedAssets as { label: string; comment: string }[]),
        portalUrl,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: 'Necesito un ajuste en tus materiales',
        html,
      });
    });

    // Esperar 4 días
    await step.sleep('wait-4d', '4d');

    await step.run('send-E09-if-incomplete', async () => {
      const [current] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (current?.status !== 'ASSETS_INCOMPLETE') return;

      const html = render(E09AssetsIncompleteD4({ clientName: data.client.fullName, portalUrl }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: '¿Pudiste actualizar los materiales?',
        html,
      });
    });

    // Esperar 4 días más (total: 8 días)
    await step.sleep('wait-4d-more', '4d');

    await step.run('send-E10-if-incomplete', async () => {
      const [current] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (current?.status !== 'ASSETS_INCOMPLETE') return;

      const html = render(E10AssetsIncompleteD8({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        portalUrl,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: 'Aviso importante sobre tu proyecto',
        html,
      });
    });
  }
);
