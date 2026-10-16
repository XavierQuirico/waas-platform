// on-incident-reported: Notifica al admin cuando un cliente reporta incidencia
// Trigger: event 'waas/incident.reported'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { incidents, projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';


export const onIncidentReported = inngest.createFunction(
  { id: 'on-incident-reported' },
  { event: 'waas/incident.reported' },
  async ({ event, step }) => {
    const { projectId, incidentId, title } = event.data as {
      projectId: string;
      incidentId: string;
      title: string;
    };

    const context = await step.run('fetch-context', async () => {
      const [incident] = await db
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      const [project] = await db
        .select({ id: projects.id, clientId: projects.clientId, productionUrl: projects.productionUrl })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) throw new Error(`Project ${projectId} not found`);

      const [client] = await db
        .select({ fullName: clients.fullName, email: clients.email, businessName: clients.businessName })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);

      return { incident, project, client };
    });

    // Notificar al admin por email
    await step.run('notify-admin', async () => {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `🚨 Incidencia reportada: ${title}`,
        text: [
          `Cliente: ${context.client.fullName} (${context.client.businessName})`,
          `Proyecto: ${context.project.productionUrl || projectId}`,
          `Título: ${title}`,
          `Descripción: ${context.incident?.description || '(sin descripción)'}`,
          `Reportado por: CLIENT`,
          '',
          `Gestionar: ${process.env.NEXT_PUBLIC_APP_URL}/proyectos/${projectId}`,
        ].join('\n'),
      });
    });
  }
);
