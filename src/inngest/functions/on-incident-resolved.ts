// on-incident-resolved: Notifica al cliente cuando se resuelve su incidencia
// Trigger: event 'waas/incident.resolved'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { incidents, projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';


export const onIncidentResolved = inngest.createFunction(
  { id: 'on-incident-resolved' },
  { event: 'waas/incident.resolved' },
  async ({ event, step }) => {
    const { projectId, incidentId, autoResolved } = event.data as {
      projectId: string;
      incidentId: string;
      autoResolved: boolean;
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

    // Notificar al cliente
    await step.run('notify-client', async () => {
      const resolvedNote = context.incident?.resolvedNote || 'El problema ha sido resuelto.';

      await resend.emails.send({
        from: EMAIL_FROM,
        to: context.client.email,
        subject: `✅ Incidencia resuelta — ${context.client.businessName}`,
        text: [
          `Hola ${context.client.fullName},`,
          '',
          `La incidencia "${context.incident?.title}" ha sido resuelta.`,
          '',
          `Nota: ${resolvedNote}`,
          '',
          `Tu sitio está funcionando correctamente: ${context.project.productionUrl || '(URL pendiente)'}`,
          '',
          `Puedes ver el estado de tu sitio en: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
          '',
          '— Xavier, WaaS',
        ].join('\n'),
      });
    });

    // Notificar al admin también
    await step.run('notify-admin', async () => {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `✅ Incidencia resuelta: ${context.incident?.title}`,
        text: [
          `Proyecto: ${context.client.businessName}`,
          `Incidencia: ${context.incident?.title}`,
          `Auto-resuelto: ${autoResolved ? 'Sí (UptimeRobot)' : 'No (manual)'}`,
          `Nota: ${context.incident?.resolvedNote || '—'}`,
        ].join('\n'),
      });
    });
  }
);
