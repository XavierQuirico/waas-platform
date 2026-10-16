// on-revisions-submitted: E13 → el admin
// Trigger: event 'waas/revisions.submitted'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients, stagingFeedback } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E13RevisionRequestedAdmin from '@/emails/E13-revision-requested-admin';


export const onRevisionsSubmitted = inngest.createFunction(
  { id: 'on-revisions-submitted' },
  { event: 'waas/revisions.submitted' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    await step.run('send-E13', async () => {
      const [project] = await db
        .select({ clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({ fullName: clients.fullName, businessName: clients.businessName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      // Obtener el último feedback
      const [feedback] = await db
        .select({ items: stagingFeedback.items })
        .from(stagingFeedback)
        .where(eq(stagingFeedback.projectId, projectId))
        .orderBy(desc(stagingFeedback.submittedAt))
        .limit(1);

      const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/proyectos/${projectId}`;
      const html = render(E13RevisionRequestedAdmin({
        clientName: client.fullName,
        businessName: client.businessName,
        feedback: (feedback?.items) ?? [],
        reviewUrl,
      }));

      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `Feedback de staging — ${client.businessName}`,
        html,
      });
    });
  }
);
