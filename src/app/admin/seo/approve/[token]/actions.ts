'use server';

import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { seoApprovalTokens } from '@/db/schema/seo-approval-tokens';
import { seoReports } from '@/db/schema/seo-reports';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E22SeoReportClient from '@/emails/E22-seo-report-client';


async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('No autorizado.');

  const isAdmin = userId === process.env.ADMIN_CLERK_USER_ID;
  if (isAdmin) return;

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  if (!admin) throw new Error('No autorizado.');
}

export async function approveSeoReport(
  token: string,
  changesApplied: string,
  contentSuggestions: string
) {
  await assertAdmin();

  const now = new Date();

  // Verificar token válido (no usado, no expirado)
  const [tokenRecord] = await db
    .select()
    .from(seoApprovalTokens)
    .where(
      and(
        eq(seoApprovalTokens.token, token),
        isNull(seoApprovalTokens.usedAt),
        gt(seoApprovalTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (!tokenRecord || !tokenRecord.reportData) {
    throw new Error('Token inválido o expirado.');
  }

  const report = tokenRecord.reportData;

  // Renderizar email E22 para el cliente
  const html = await render(
    E22SeoReportClient({
      clientName: report.clientName,
      businessName: report.businessName,
      productionUrl: report.productionUrl,
      period: report.period,
      currentScore: report.currentScore,
      previousScore: report.previousScore,
      cruxScore: report.cruxScore,
      topIssues: report.topIssues,
      changesApplied: changesApplied.trim() || undefined,
      contentSuggestions: contentSuggestions.trim() || undefined,
    })
  );

  // Enviar E22 al cliente
  await resend.emails.send({
    from: EMAIL_FROM,
    to: report.clientEmail,
    subject: `Tu reporte de Salud Técnica SEO — ${report.businessName} (${report.period})`,
    html,
  });

  // Marcar token como usado + guardar notas de Xavier
  await db
    .update(seoApprovalTokens)
    .set({
      usedAt: now,
      changesApplied: changesApplied.trim() || null,
      contentSuggestions: contentSuggestions.trim() || null,
    })
    .where(eq(seoApprovalTokens.token, token));

  // Marcar los seo_reports del proyecto como aprobados
  await db
    .update(seoReports)
    .set({
      approvedByAdmin: true,
      reportSentAt: now,
    })
    .where(
      and(
        eq(seoReports.projectId, tokenRecord.projectId),
        isNull(seoReports.reportSentAt),
        lte(seoReports.checkedAt, now)
      )
    );

  redirect('/admin/seo/approve/success');
}
