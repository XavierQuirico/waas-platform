// monthly-seo-report: Genera y envía el reporte SEO mensual al admin para su aprobación
// Cron: primer lunes de cada mes a las 10am AST (1h después del check semanal si coinciden)

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { clients } from '@/db/schema/clients';
import { seoReports } from '@/db/schema/seo-reports';
import { seoApprovalTokens, type SeoMonthlyReportData } from '@/db/schema/seo-approval-tokens';
import { eq, and, inArray, isNotNull, desc } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { isFirstWeekOfMonth } from '@/lib/seo/schedule';
import { render } from '@react-email/render';
import E21SeoReportAdmin from '@/emails/E21-seo-report-admin';
import crypto from 'crypto';


const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatPeriod(date: Date): string {
  return `${SPANISH_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatExpiryDate(date: Date): string {
  return date.toLocaleDateString('es-DO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santo_Domingo',
  });
}

export const monthlySeoReport = inngest.createFunction(
  { id: 'monthly-seo-report' },
  // Todos los lunes a las 10am AST; solo el primero del mes continúa (ver isFirstWeekOfMonth).
  { cron: 'TZ=America/Santo_Domingo 0 10 * * 1' },
  async ({ step }) => {
    const now = new Date();
    if (!isFirstWeekOfMonth(now)) return { skipped: true };
    const period = formatPeriod(now);
    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';

    // 1. Obtener proyectos LIVE PRO/BUSINESS con URL de producción + datos de cliente
    const liveProjects = await step.run('fetch-eligible-projects', async () => {
      return db
        .select({
          projectId: projects.id,
          clientName: clients.fullName,
          businessName: clients.businessName,
          clientEmail: clients.email,
          productionUrl: projects.productionUrl,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(
          and(
            eq(projects.status, 'LIVE'),
            inArray(projects.plan, ['PRO', 'BUSINESS']),
            isNotNull(projects.productionUrl)
          )
        );
    });

    if (liveProjects.length === 0) return { processed: 0, period };

    const processed: string[] = [];
    const skipped: string[] = [];

    // 2. Procesar cada proyecto (secuencial para no saturar Resend)
    for (const project of liveProjects) {
      const result = await step.run(`process-${project.projectId}`, async () => {
        // Últimas 4 semanas de datos (de más reciente a más antiguo)
        const recentReports = await db
          .select({
            lighthouseScore: seoReports.lighthouseScore,
            cruxScore: seoReports.cruxScore,
            topIssues: seoReports.topIssues,
            status: seoReports.status,
          })
          .from(seoReports)
          .where(
            and(
              eq(seoReports.projectId, project.projectId),
              eq(seoReports.status, 'ok')
            )
          )
          .orderBy(desc(seoReports.checkedAt))
          .limit(4);

        // Sin datos suficientes → saltar este mes
        if (recentReports.length === 0) return { skipped: true };

        const currentScore = recentReports[0].lighthouseScore ?? null;
        const previousScore =
          recentReports.length >= 2
            ? recentReports[recentReports.length - 1].lighthouseScore ?? null
            : null;

        const cruxScore = recentReports[0].cruxScore ?? null;
        const topIssues = recentReports[0].topIssues ?? [];

        // Generar token seguro de 64 chars hex (256-bit)
        const token = crypto.randomBytes(32).toString('hex');

        // TTL de 48 horas
        const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const reportData: SeoMonthlyReportData = {
          clientName: project.clientName,
          businessName: project.businessName,
          clientEmail: project.clientEmail,
          productionUrl: project.productionUrl!,
          period,
          currentScore,
          previousScore,
          cruxScore,
          topIssues,
        };

        // Guardar token en DB
        await db.insert(seoApprovalTokens).values({
          projectId: project.projectId,
          token,
          reportData,
          expiresAt,
        });

        // Construir URL de aprobación
        const approvalUrl = `${appUrl}/admin/seo/approve/${token}`;

        // Renderizar y enviar E21 al admin
        const html = await render(
          E21SeoReportAdmin({
            clientName: project.clientName,
            businessName: project.businessName,
            productionUrl: project.productionUrl!,
            period,
            currentScore,
            previousScore,
            cruxScore,
            topIssues,
            approvalUrl,
            expiresAt: formatExpiryDate(expiresAt),
          })
        );

        await resend.emails.send({
          from: EMAIL_FROM,
          to: process.env.ADMIN_EMAIL!,
          subject: `📊 SEO ${period} — ${project.businessName} (aprobación pendiente)`,
          html,
        });

        return { skipped: false };
      });

      if (result.skipped) {
        skipped.push(project.projectId);
      } else {
        processed.push(project.projectId);
      }
    }

    return {
      period,
      total: liveProjects.length,
      processed: processed.length,
      skipped: skipped.length,
    };
  }
);
