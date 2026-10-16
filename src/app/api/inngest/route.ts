// Next.js App Router — Inngest serve handler
// Registra todas las funciones de Inngest en /api/inngest

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { onPaymentReceived } from '@/inngest/functions/on-payment-received';
import { onProposalSent } from '@/inngest/functions/on-proposal-sent';
import { onAssetsSubmitted } from '@/inngest/functions/on-assets-submitted';
import { onAssetsIncomplete } from '@/inngest/functions/on-assets-incomplete';
import { onProductionStarted } from '@/inngest/functions/on-production-started';
import { onStagingDeployed } from '@/inngest/functions/on-staging-deployed';
import { onRevisionsSubmitted } from '@/inngest/functions/on-revisions-submitted';
import { onProjectLive } from '@/inngest/functions/on-project-live';
import { onPaymentFailed } from '@/inngest/functions/on-payment-failed';
import { onSubscriptionCancelled } from '@/inngest/functions/on-subscription-cancelled';
import { weeklySummary } from '@/inngest/functions/weekly-summary';
import { onIncidentReported } from '@/inngest/functions/on-incident-reported';
import { onSiteDown } from '@/inngest/functions/on-site-down';
import { onIncidentResolved } from '@/inngest/functions/on-incident-resolved';
import { weeklySeoCheck } from '@/inngest/functions/weekly-seo-check';
import { monthlySeoReport } from '@/inngest/functions/monthly-seo-report';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onPaymentReceived,
    onProposalSent,
    onAssetsSubmitted,
    onAssetsIncomplete,
    onProductionStarted,
    onStagingDeployed,
    onRevisionsSubmitted,
    onProjectLive,
    onPaymentFailed,
    onSubscriptionCancelled,
    weeklySummary,
    onIncidentReported,
    onSiteDown,
    onIncidentResolved,
    weeklySeoCheck,
    monthlySeoReport,
  ],
});
