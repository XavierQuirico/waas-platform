import { formatMoneyCents } from '@/lib/portal/billing-state';
import type { BillingTicketRow } from './data';

const STATUS_LABELS: Record<string, string> = {
  quote_requested: 'Cotización solicitada',
  quote_needs_info: 'Necesita información',
  quote_priced: 'Cotización lista',
  quote_declined: 'Cotización declinada',
  payment_pending: 'Pago pendiente',
  paid: 'Pagado',
  in_progress: 'En progreso',
  delivered: 'Entregado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  submitted: 'Enviado',
};

const STATUS_COLORS: Record<string, string> = {
  quote_requested: '#a78bfa',
  quote_needs_info: '#fbbf24',
  quote_priced: '#60a5fa',
  payment_pending: '#fb923c',
  paid: '#4ade80',
  in_progress: '#34d399',
  delivered: '#4ade80',
  rejected: '#f87171',
  cancelled: 'var(--text-3)',
  quote_declined: 'var(--text-3)',
  submitted: 'var(--text-2)',
};

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '24px',
  marginBottom: 16,
};

interface BillingTicketListProps {
  tickets: BillingTicketRow[];
}

export function BillingTicketList({ tickets }: BillingTicketListProps) {
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
        Solicitudes cobrables
      </p>
      {tickets.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: 0 }}>
          No hay solicitudes cobrables activas en este proyecto.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {tickets.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
                padding: '11px 0',
                borderBottom: i < tickets.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
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
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.title}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '2px 0 0' }}>
                  {t.ticketNumber}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {t.priceAmount > 0 && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {formatMoneyCents(t.priceAmount, t.priceCurrency)}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: STATUS_COLORS[t.clientStatus] ?? 'var(--text-3)',
                    fontFamily: 'var(--font-body)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 8px',
                    borderRadius: 100,
                    border: `1px solid ${STATUS_COLORS[t.clientStatus] ?? 'rgba(128,128,128,0.2)'}40`,
                    background: `${STATUS_COLORS[t.clientStatus] ?? 'rgba(128,128,128,0.1)'}18`,
                  }}
                >
                  {STATUS_LABELS[t.clientStatus] ?? t.clientStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
