import type { ProjectType } from '@/lib/portal/project-type';
import { whatsappUrl, formatWhatsAppDisplay } from '@/lib/config/contact';

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '24px',
  marginBottom: 16,
};

interface BillingHelpCardProps {
  projectType: ProjectType;
  showPayPal?: boolean;
}

export function BillingHelpCard({ projectType, showPayPal }: BillingHelpCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {projectType === 'SUBSCRIPTION' && showPayPal && (
        <div style={card}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-body)',
              margin: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Gestionar suscripción
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '0 0 14px' }}>
            Tu suscripción es administrada a través de PayPal. Puedes actualizar tu método de pago
            o cancelarla en cualquier momento desde tu cuenta.
          </p>
          <a
            href="https://www.paypal.com/myaccount/autopay"
            target="_blank"
            rel="noopener noreferrer"
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
            Administrar en PayPal →
          </a>
        </div>
      )}
      <div style={card}>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-body)',
            margin: '0 0 12px',
          }}
        >
          {projectType === 'SUBSCRIPTION'
            ? '¿Tienes preguntas sobre tu factura? Escríbele a Xavier por WhatsApp.'
            : '¿Tienes preguntas sobre tu proyecto? Escríbele a Xavier.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#16a34a',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            WhatsApp: {formatWhatsAppDisplay()}
          </a>
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
    </div>
  );
}
