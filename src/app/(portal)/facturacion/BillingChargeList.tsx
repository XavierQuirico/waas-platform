import { formatMoneyCents, formatBillingDate } from '@/lib/portal/billing-state';
import type { BillingPaymentEvent } from './data';

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '24px',
  marginBottom: 16,
};

interface BillingChargeListProps {
  events: BillingPaymentEvent[];
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  setup: 'Setup fee',
  subscription: 'Mensualidad',
  addon: 'Add-on',
  reactivation: 'Reactivación',
  manual: 'Manual',
};

export function BillingChargeList({ events }: BillingChargeListProps) {
  return (
    <div style={card}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-body)',
          margin: '0 0 14px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Historial de pagos
      </p>
      {events.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: 0 }}>
          Aún no hay pagos registrados en el portal.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
                padding: '11px 0',
                borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-body)',
                    margin: 0,
                  }}
                >
                  {e.paymentType ? (PAYMENT_TYPE_LABELS[e.paymentType] ?? e.paymentType) : 'Pago recibido'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '2px 0 0' }}>
                  {formatBillingDate(e.createdAt)}
                  {e.method && ` · ${e.method}`}
                </p>
              </div>
              {e.totalAmountCents !== null && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    flexShrink: 0,
                  }}
                >
                  {formatMoneyCents(e.totalAmountCents)}
                </span>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#4ade80',
                  fontFamily: 'var(--font-body)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '2px 8px',
                  borderRadius: 100,
                  border: '1px solid rgba(74,222,128,0.2)',
                  background: 'rgba(74,222,128,0.08)',
                  flexShrink: 0,
                }}
              >
                Recibido
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
