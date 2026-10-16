// on-staging-deployed: E12 → cliente
// Trigger: event 'waas/staging.deployed'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E12StagingReady from '@/emails/E12-staging-ready';


export const onStagingDeployed = inngest.createFunction(
  { id: 'on-staging-deployed' },
  { event: 'waas/staging.deployed' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    await step.run('send-E12', async () => {
      const [project] = await db
        .select({ clientId: projects.clientId, stagingUrl: projects.stagingUrl, stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({ fullName: clients.fullName, email: clients.email, businessName: clients.businessName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proyecto/${projectId}/staging`;
      const reviewDeadline = project.stagingReviewDeadlineAt
        ? new Date(project.stagingReviewDeadlineAt).toLocaleDateString('es-DO', {
            weekday: 'long', day: 'numeric', month: 'long',
          })
        : '72 horas hábiles';

      const html = render(E12StagingReady({
        clientName: client.fullName,
        businessName: client.businessName,
        stagingUrl: project.stagingUrl ?? '',
        feedbackUrl,
        reviewDeadline,
      }));

      await resend.emails.send({
        from: EMAIL_FROM,
        to: client.email,
        subject: '👀 Tu sitio está listo para revisión',
        html,
      });
    });
  }
);
