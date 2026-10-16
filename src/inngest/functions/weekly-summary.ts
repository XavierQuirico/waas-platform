// weekly-summary: Resumen semanal de actividad para el admin
// Cron: todos los lunes a las 8am (AST = UTC-4)

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, incidents, projectEvents } from '@/db/schema';
import { gte, eq, count } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';

export const weeklySummary = inngest.createFunction(
  { id: 'weekly-summary' },
  { cron: 'TZ=America/Santo_Domingo 0 8 * * 1' },
  async ({ step }) => {
    const summary = await step.run('gather-metrics', async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Proyectos activos por estado
      const activeProjects = await db
        .select({
          status: projects.status,
          count: count(),
        })
        .from(projects)
        .groupBy(projects.status);

      // Eventos de la última semana
      const weeklyEvents = await db
        .select({ count: count() })
        .from(projectEvents)
        .where(gte(projectEvents.createdAt, oneWeekAgo));

      // Incidencias abiertas
      const openIncidents = await db
        .select({ count: count() })
        .from(incidents)
        .where(eq(incidents.status, 'OPEN'));

      // Incidencias resueltas esta semana
      const resolvedThisWeek = await db
        .select({ count: count() })
        .from(incidents)
        .where(gte(incidents.resolvedAt, oneWeekAgo));

      return {
        activeProjects,
        totalEvents: weeklyEvents[0]?.count ?? 0,
        openIncidents: openIncidents[0]?.count ?? 0,
        resolvedThisWeek: resolvedThisWeek[0]?.count ?? 0,
      };
    });

    await step.run('send-summary-email', async () => {
      const projectLines = summary.activeProjects
        .map((p) => `  • ${p.status}: ${p.count}`)
        .join('\n');

      await resend.emails.send({
        from: EMAIL_FROM,
        to: process.env.ADMIN_EMAIL!,
        subject: `📊 Resumen semanal WaaS — ${new Date().toLocaleDateString('es-DO')}`,
        text: [
          'Resumen Semanal WaaS',
          '═══════════════════',
          '',
          'Proyectos por estado:',
          projectLines || '  (sin proyectos)',
          '',
          `Eventos registrados esta semana: ${summary.totalEvents}`,
          `Incidencias abiertas: ${summary.openIncidents}`,
          `Incidencias resueltas esta semana: ${summary.resolvedThisWeek}`,
          '',
          '— Sistema WaaS',
        ].join('\n'),
      });
    });

    return { sent: true, summary };
  }
);
