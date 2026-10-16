import { formatMoneyCents } from '@/lib/portal/billing-state';
import type { BillingProject, BillingMaintenanceContract } from './data';

const PLAN_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

const TIER_LABELS: Record<string, string> = {
  care: 'Care',
  care_plus: 'Care Plus',
  care_pro: 'Care Pro',
  custom: 'Personalizado',
};

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '24px',
  marginBottom: 16,
};

interface BillingPlanCardProps {
  project: BillingProject;
  maintenanceContracts: BillingMaintenanceContract[];
  showPayPal?: boolean;
}

export function BillingPlanCard({ project, maintenanceContracts, showPayPal = false }: BillingPlanCardProps) {
  const { projectType, plan, monthlyPriceCents, setupFeeCents, status } = project;
  const isSuspended = status === 'SUSPENDED';
  const isCancelled = status === 'CANCELLED';

  if (projectType === 'PORTFOLIO') {
    return (
      <div style={card}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-body)',
            margin: '0 0 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Tipo de proyecto
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 4px',
          }}
        >
          Proyecto portfolio
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: 0 }}>
          Sin facturación recurrente. Este proyecto no requiere un plan mensual.
        </p>
      </div>
    );
  }

  if (projectType === 'LEGACY') {
    const activeContracts = maintenanceContracts.filter(
      (c) => c.status === 'active' || c.status === 'paused',
    );
    return (
      <div style={card}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-body)',
            margin: '0 0 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Tipo de proyecto
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 4px',
          }}
        >
          Proyecto legacy
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '0 0 12px' }}>
          Tu proyecto tiene facturación manual o histórica. No hay renovación automática ni suscripción mensual SaaS.
        </p>
        {activeContracts.length > 0 && (
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-3)',
                fontFamily: 'var(--font-body)',
                margin: '0 0 10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Contratos de mantenimiento
            </p>
            {activeContracts.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}
                  >
                    {TIER_LABELS[c.tier] ?? c.tier}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    {formatMoneyCents(c.monthlyPriceCents)}/mes
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)', marginTop: 4 }}>
                  {c.hostingIncluded && `Hosting gestionado incluido (+${formatMoneyCents(c.hostingPriceCents)}/mes) · `}
                  Estado: {c.status === 'active' ? 'Activo' : 'En pausa'}
                  {c.nextBillingAt && (
                    <>
                      {' · '}Próximo cobro:{' '}
                      {c.nextBillingAt.toLocaleDateString('es-DO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SUBSCRIPTION
  return (
    <div style={card}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-body)',
          margin: '0 0 12px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Plan activo
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              margin: 0,
            }}
          >
            {PLAN_LABELS[plan] ?? plan}
          </p>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            {formatMoneyCents(monthlyPriceCents)}/mes · {showPayPal ? 'Renovación automática vía PayPal' : 'Gestión de pago por soporte'}
          </p>
          {setupFeeCents > 0 && (
            <p style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
              Setup fee: {formatMoneyCents(setupFeeCents)} (único)
            </p>
          )}
        </div>
        {!isCancelled && (
          <span
            style={{
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: isSuspended ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(34,197,94,0.25)',
              background: isSuspended ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
              color: isSuspended ? '#f87171' : '#4ade80',
            }}
          >
            {isSuspended ? 'Suspendida' : 'Activa'}
          </span>
        )}
      </div>
    </div>
  );
}
