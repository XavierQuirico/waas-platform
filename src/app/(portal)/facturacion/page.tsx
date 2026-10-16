import { requirePortalClient } from '@/lib/portal/context';
import { getClientBillingPageData } from './data';
import { deriveBillingVisualState, canShowPayPalManagement } from '@/lib/portal/billing-state';
import { BillingStatusBanner } from './BillingStatusBanner';
import { BillingPlanCard } from './BillingPlanCard';
import { BillingProjectSelector } from './BillingProjectSelector';
import { BillingTicketList } from './BillingTicketList';
import { BillingChargeList } from './BillingChargeList';
import { BillingHelpCard } from './BillingHelpCard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Facturación — Quirico Studios',
};

const wrap: React.CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '0 0 24px',
};

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '24px',
  marginBottom: 16,
};

interface FacturacionPageProps {
  searchParams: Promise<{ p?: string }>;
}

export default async function FacturacionPage({ searchParams }: FacturacionPageProps) {
  const { client } = await requirePortalClient();
  const { p: requestedProjectId } = await searchParams;

  const data = await getClientBillingPageData(client.id, requestedProjectId);

  // ── Empty state ────────────────────────────────────────────
  if (!data) {
    return (
      <div style={wrap}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Facturación
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Consulta tu plan, pagos y solicitudes cobrables.
          </p>
        </div>
        <div style={card}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              margin: '0 0 6px',
            }}
          >
            Sin proyecto activo
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '0 0 14px' }}>
            Tu información de facturación aparecerá aquí cuando Xavier active tu proyecto.
          </p>
          <a
            href="/soporte"
            style={{
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
            }}
          >
            Ir a soporte
          </a>
        </div>
      </div>
    );
  }

  const { allProjects, selectedProject, tickets, paymentEvents, maintenanceContracts } = data;
  const { projectType, paymentGracePeriodUntil, suspendedAt, reactivationFeeActive, status } = selectedProject;

  const billingState = deriveBillingVisualState({
    status,
    paymentGracePeriodUntil,
    suspendedAt,
    reactivationFeeActive,
  });

  // ── PORTFOLIO ──────────────────────────────────────────────
  if (projectType === 'PORTFOLIO') {
    return (
      <div style={wrap}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Facturación
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Consulta tu plan, pagos y solicitudes cobrables.
          </p>
        </div>
        <BillingProjectSelector allProjects={allProjects} selectedProjectId={selectedProject.id} />
        <BillingPlanCard project={selectedProject} maintenanceContracts={[]} />
        <BillingHelpCard projectType={projectType} />
      </div>
    );
  }

  // ── LEGACY ─────────────────────────────────────────────────
  if (projectType === 'LEGACY') {
    return (
      <div style={wrap}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Facturación
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Consulta tu plan, pagos y solicitudes cobrables.
          </p>
        </div>
        <BillingProjectSelector allProjects={allProjects} selectedProjectId={selectedProject.id} />
        <BillingPlanCard project={selectedProject} maintenanceContracts={maintenanceContracts} />
        {tickets.length > 0 && <BillingTicketList tickets={tickets} />}
        <BillingChargeList events={paymentEvents} />
        <BillingHelpCard projectType={projectType} />
      </div>
    );
  }

  // ── SUBSCRIPTION ───────────────────────────────────────────
  const showPayPal = canShowPayPalManagement(projectType, selectedProject.paypalSubscriptionId, billingState);

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Facturación
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
          Consulta tu plan, pagos y solicitudes cobrables.
        </p>
      </div>

      <BillingProjectSelector allProjects={allProjects} selectedProjectId={selectedProject.id} />

      <BillingStatusBanner state={billingState} gracePeriodUntil={paymentGracePeriodUntil} showPayPal={showPayPal} />

      <BillingPlanCard project={selectedProject} maintenanceContracts={[]} showPayPal={showPayPal} />

      <BillingTicketList tickets={tickets} />

      <BillingChargeList events={paymentEvents} />

      <BillingHelpCard projectType={projectType} showPayPal={showPayPal} />
    </div>
  );
}
