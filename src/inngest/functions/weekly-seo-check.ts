// weekly-seo-check: Verificación semanal de salud técnica SEO
// Cron: todos los lunes a las 9am AST (= UTC-4) — 1h después de weekly-summary
// Solo aplica a proyectos LIVE con plan PRO o BUSINESS que tengan productionUrl

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { seoReports } from '@/db/schema/seo-reports';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { checkSiteAvailability, runPageSpeed } from '@/lib/seo/pagespeed';
import { resend, EMAIL_FROM } from '@/lib/email/sender';


export const weeklySeoCheck = inngest.createFunction(
  { id: 'weekly-seo-check' },
  { cron: 'TZ=America/Santo_Domingo 0 9 * * 1' },
  async ({ step }) => {
    // 1. Obtener proyectos LIVE con plan PRO o BUSINESS que tengan URL de producción
    const liveProjects = await step.run('fetch-live-projects', async () => {
      return db
        .select({
          id: projects.id,
          plan: projects.plan,
          productionUrl: projects.productionUrl,
        })
        .from(projects)
        .where(
          and(
            eq(projects.status, 'LIVE'),
            inArray(projects.plan, ['PRO', 'BUSINESS']),
            isNotNull(projects.productionUrl)
          )
        );
    });

    if (liveProjects.length === 0) return { checked: 0 };

    // 2. Verificar y chequear cada proyecto
    const results = await step.run('run-pagespeed-checks', async () => {
      const checked: string[] = [];
      const unreachable: string[] = [];
      const errors: string[] = [];

      for (const project of liveProjects) {
        const url = project.productionUrl!;

        // HEAD request primero para confirmar disponibilidad
        const isAvailable = await checkSiteAvailability(url);

        if (!isAvailable) {
          await db.insert(seoReports).values({
            projectId: project.id,
            status: 'site_unreachable',
          });
          unreachable.push(project.id);
          continue;
        }

        // Llamada a PageSpeed (mobile — estrategia principal para Google)
        const result = await runPageSpeed(url);

        if (result.status === 'api_error') {
          await db.insert(seoReports).values({
            projectId: project.id,
            status: 'api_error',
          });
          errors.push(project.id);
          continue;
        }

        await db.insert(seoReports).values({
          projectId: project.id,
          status: 'ok',
          lighthouseScore: result.lighthouseScore ?? undefined,
          cruxScore: result.cruxScore ?? undefined,
          lcpMs: result.lcpMs ?? undefined,
          clsScore: result.clsScore ?? undefined,
          inpMs: result.inpMs ?? undefined,
          topIssues: result.topIssues.length > 0 ? result.topIssues : undefined,
          rawData: result.rawData,
        });

        checked.push(project.id);
      }

      return { checked, unreachable, errors };
    });

    // 3. Notificar al admin si hay sitios no disponibles (problema crítico)
    if (results.unreachable.length > 0) {
      await step.run('notify-unreachable', async () => {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: process.env.ADMIN_EMAIL!,
          subject: `⚠️ SEO Check — ${results.unreachable.length} sitio(s) no disponible(s)`,
          text: [
            'Check SEO Semanal — Sitios no disponibles',
            '══════════════════════════════════════════',
            '',
            `${results.unreachable.length} sitio(s) no respondieron al check de esta semana.`,
            'IDs de proyectos afectados:',
            ...results.unreachable.map((id) => `  • ${id}`),
            '',
            'Verifica estos sitios manualmente.',
            '— Sistema WaaS',
          ].join('\n'),
        });
      });
    }

    return {
      total: liveProjects.length,
      checked: results.checked.length,
      unreachable: results.unreachable.length,
      errors: results.errors.length,
    };
  }
);
