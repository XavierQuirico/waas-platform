import { whatsappUrl } from '@/lib/config/contact';
export function PortalHelpCard() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,140,0,0.06) 0%, transparent 100%)',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,140,0,0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--text)',
              marginBottom: 3,
            }}
          >
            ¿Necesitas ayuda?
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Xavier está disponible para resolver tus dudas.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'rgba(37,211,102,0.12)',
              color: '#25D366',
              padding: '8px 14px',
              borderRadius: 8,
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Escribir por WhatsApp
          </a>
          <a
            href="mailto:hola@quiricostudios.com"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              padding: '8px 14px',
              borderRadius: 8,
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Enviar email
          </a>
        </div>
      </div>
    </div>
  );
}
