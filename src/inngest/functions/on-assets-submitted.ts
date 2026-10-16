// on-assets-submitted: E06 + E07 + transición ASSETS_UNDER_REVIEW
// Trigger: event 'waas/assets.submitted'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E06AssetsSubmittedClient from '@/emails/E06-assets-submitted-client';
import E07AssetsSubmittedAdmin from '@/emails/E07-assets-submitted-admin';


export const onAssetsSubmitted = inngest.createFunction(
  { id: 'on-assets-submitted' },
  { event: 'waas/assets.submitted' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({ id: projects.id, plan: projects.plan, clientId: projects.clientId })
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

    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/proyectos/${projectId}`;
    const submittedAt = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    // E06 → cliente
    await step.run('send-E06', async () => {
      const html = render(E06AssetsSubmittedClient({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: '✓ Materiales recibidos',
        html,
      });
    });

    // E07 → el admin
    await step.run('send-E07', async () => {
      const html = render(E07AssetsSubmittedAdmin({
        clientName: data.client.fullName,
        businessName: data.client.businessName,
        plan: data.project.plan,
        reviewUrl,
        submittedAt,
      }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `Nuevos assets — ${data.client.businessName}`,
        html,
      });
    });

    // Transicionar a ASSETS_UNDER_REVIEW
    await step.run('transition-to-under-review', async () => {
      await db
        .update(projects)
        .set({ status: 'ASSETS_UNDER_REVIEW' as const, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    });
  }
);
