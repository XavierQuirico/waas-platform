// on-site-down: Alerta crítica cuando UptimeRobot detecta caída
// Trigger: event 'waas/site.down'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';


export const onSiteDown = inngest.createFunction(
  { id: 'on-site-down' },
  { event: 'waas/site.down' },
  async ({ event, step }) => {
    const { projectId, incidentId, monitorURL } = event.data as {
      projectId: string;
      incidentId: string;
      monitorURL: string;
    };

    const context = await step.run('fetch-context', async () => {
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

      return { project, client };
    });

    // Alerta urgente al admin
    await step.run('alert-admin', async () => {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `🔴 SITIO CAÍDO: ${context.client.businessName} — ${monitorURL}`,
        text: [
          '⚠️ ALERTA CRÍTICA — Sitio no responde',
          '',
          `Cliente: ${context.client.fullName} (${context.client.businessName})`,
          `URL: ${monitorURL}`,
          `Incidencia: ${incidentId}`,
          '',
          'Acción requerida: Verificar el estado del hosting y restaurar el servicio.',
        ].join('\n'),
      });
    });

    // Notificar al cliente que estamos al tanto
    await step.run('notify-client', async () => {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: context.client.email,
        subject: `Detectamos un problema con tu sitio — ${context.client.businessName}`,
        text: [
          `Hola ${context.client.fullName},`,
          '',
          `Nuestro sistema de monitoreo detectó que tu sitio (${monitorURL}) podría estar experimentando problemas.`,
          '',
          'Ya estamos trabajando en resolverlo y te notificaremos cuando esté de vuelta en línea.',
          '',
          'Si tienes preguntas, responde a este correo.',
          '',
          '— Xavier, WaaS',
        ].join('\n'),
      });
    });
  }
);
