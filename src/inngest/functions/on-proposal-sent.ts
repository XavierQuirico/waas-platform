// on-proposal-sent: schedules E04 (d3), E05 (d7), expiry check
// Trigger: event 'waas/proposal.sent'

import { inngest } from '@/inngest/client';
import { db } from '@/db';
import { projects, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resend, EMAIL_FROM } from '@/lib/email/sender';
import { render } from '@react-email/render';
import E03ProposalSent from '@/emails/E03-proposal-sent';
import E04ProposalFollowupD3 from '@/emails/E04-proposal-followup-d3';
import E05ProposalFollowupD7 from '@/emails/E05-proposal-followup-d7';


export const onProposalSent = inngest.createFunction(
  { id: 'on-proposal-sent' },
  { event: 'waas/proposal.sent' },
  async ({ event, step }) => {
    const { projectId } = event.data as { projectId: string };

    const data = await step.run('fetch-project', async () => {
      const [project] = await db
        .select({ clientId: projects.clientId, proposalExpiresAt: projects.proposalExpiresAt, status: projects.status, plan: projects.plan, monthlyPriceCents: projects.monthlyPriceCents })
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

    const expiresAt = data.project.proposalExpiresAt
      ? new Date(data.project.proposalExpiresAt).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
      : '7 días';

    // E03 — confirmación inmediata al cliente de que su propuesta está lista
    await step.run('send-E03-proposal-ready', async () => {
      const html = render(
        E03ProposalSent({
          clientName: data.client.fullName,
          businessName: data.client.businessName ?? '',
          plan: data.project.plan ?? '',
          monthlyPrice: (data.project.monthlyPriceCents ?? 0) / 100,
          setupFee: 50,
          proposalExpiresAt: expiresAt,
        })
      );
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: 'Tu propuesta está lista — revísala antes del ' + expiresAt,
        html,
      });
    });

    // Esperar 3 días
    await step.sleep('wait-3d', '3d');

    // Verificar que aún está en PROPOSAL_SENT antes de enviar E04
    await step.run('send-E04-if-pending', async () => {
      const [current] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (current?.status !== 'PROPOSAL_SENT') return; // Ya pagó o expiró

      const html = render(
        E04ProposalFollowupD3({ clientName: data.client.fullName, businessName: '', expiresAt })
      );
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: '¿Pudiste revisar la propuesta?',
        html,
      });
    });

    // Esperar 4 días más (total: 7 días)
    await step.sleep('wait-4d-more', '4d');

    // Verificar y enviar E05 + expirar si aplica
    await step.run('send-E05-or-expire', async () => {
      const [current] = await db
        .select({ status: projects.status, proposalExpiresAt: projects.proposalExpiresAt })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (current?.status !== 'PROPOSAL_SENT') return;

      // Verificar si ya expiró
      if (current.proposalExpiresAt && new Date() >= new Date(current.proposalExpiresAt)) {
        await db
          .update(projects)
          .set({ status: 'PROPOSAL_EXPIRED' as const, updatedAt: new Date() })
          .where(eq(projects.id, projectId));
        return;
      }

      const html = render(E05ProposalFollowupD7({ clientName: data.client.fullName, expiresAt }));
      await resend.emails.send({
        from: EMAIL_FROM,
        to: data.client.email,
        subject: 'La propuesta vence mañana',
        html,
      });
    });

    // Último día: expirar si sigue sin pagar
    await step.sleep('wait-1d-final', '1d');

    await step.run('expire-if-needed', async () => {
      const [current] = await db
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (current?.status !== 'PROPOSAL_SENT') return;

      await db
        .update(projects)
        .set({ status: 'PROPOSAL_EXPIRED' as const, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    });
  }
);
