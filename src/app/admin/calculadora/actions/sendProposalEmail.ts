'use server';
// ============================================================
// Server Action — Enviar propuesta por email con Resend
// ============================================================

import { resend, EMAIL_FROM, EMAIL_REPLY_TO } from '@/lib/email/sender';
import { renderProposalHtml } from '@/lib/calculadora/proposal-template';
import type { ProposalData } from '@/lib/calculadora/types';
import { isAdmin, UNAUTHORIZED_MESSAGE } from '@/lib/admin/auth';


export async function sendProposalEmailAction(
  toEmail: string,
  proposalData: ProposalData
): Promise<{ id?: string; error?: string }> {
  if (!(await isAdmin())) return { error: UNAUTHORIZED_MESSAGE };
  try {
    const html = await renderProposalHtml(proposalData);
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: [toEmail],
      subject: `Propuesta web para ${proposalData.businessName} — Xavier Quirico`,
      html,
    });
    if (result.error) return { error: String(result.error) };
    return { id: result.data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al enviar email' };
  }
}
