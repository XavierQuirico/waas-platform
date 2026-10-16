import { requirePortalClient } from '@/lib/portal/context';
import { getMantenimientoPageData } from './data';
import {
  formatTierLabel,
  formatTierChanges,
  formatBillingMethod,
  formatContractStatus,
  formatMoneyCents,
} from '@/lib/portal/maintenance-helpers';
import type { Metadata } from 'next';
import { whatsappUrl } from '@/lib/config/contact';

export const metadata: Metadata = {
  title: 'Mantenimiento — Quirico Studios',
};

const WA_ACTIVATE = whatsappUrl('Hola Xavier, me gustaría activar un plan de mantenimiento para mi sitio Legacy. ¿Puedes orientarme?');
const WA_MODIFY = whatsappUrl('Hola Xavier, quiero modificar o revisar mi contrato de mantenimiento.');
const WA_CANCEL = whatsappUrl('Hola Xavier, quisiera hablar sobre la cancelación de mi plan de mantenimiento.');

const OFFER_PLANS = [
  { id: 'care', label: 'Care', price: '$49/mes', changes: '1 cambio menor/mes', desc: 'Soporte técnico esencial y cambios de contenido básicos.' },
  { id: 'care_plus', label: 'Care Plus', price: '$89/mes', changes: '2 cambios menores/mes', desc: 'Mayor capacidad de cambios y soporte técnico continuo.' },
  { id: 'care_pro', label: 'Care Pro', price: '$149/mes', changes: '4 cambios menores/mes', desc: 'Revisión técnica recurrente y prioridad de respuesta.' },
] as const;

interface Props {
  searchParams: Promise<{ p?: string }>;
}

const card = {
  background: 'var(--surface)',
  borderRadius: 12,
  padding: 24,
  border: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 16,
} as const;

export default async function MantenimientoPage({ searchParams }: Props) {
  const ctx = await requirePortalClient();
  const { p: requestedId } = await searchParams;

  const data = await getMantenimientoPageData(ctx.client.id, requestedId);
  const { legacyProjects, selectedProject, contracts } = data;

  // No legacy projects → "No aplica para tu plan actual"
  if (!selectedProject) {
    return (
      <div style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--text)', margin: 0 }}>
            Mantenimiento
          </h1>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              margin: '0 0 8px',
            }}
          >
            No aplica para tu plan actual
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', margin: '0 0 20px' }}>
            La sección de Mantenimiento está disponible para proyectos Legacy. Si tienes dudas,
            contacta a soporte.
          </p>
          <a
            href="/soporte"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: 13,
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

  const activeContract = contracts.find((c) => c.status === 'active');
  const contractToShow = activeContract ?? contracts[0] ?? null;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--text)', margin: 0 }}>
            Mantenimiento
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Aplica a proyectos Legacy.
          </p>
        </div>
        {contractToShow && (
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 100,
              background: contractToShow.status === 'active' ? 'rgba(93,214,156,0.12)' : 'rgba(128,128,128,0.1)',
              color: contractToShow.status === 'active' ? '#5DD69C' : 'var(--text-3)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {formatContractStatus(contractToShow.status)}
          </span>
        )}
      </div>

      {/* Project selector — only for multiple legacy projects */}
      {legacyProjects.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {legacyProjects.map((p, i) => {
            const isSelected = p.id === selectedProject.id;
            return (
              <a
                key={p.id}
                href={`/mantenimiento?p=${p.id}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  border: `1px solid ${isSelected ? '#FF8C00' : 'rgba(128,128,128,0.2)'}`,
                  background: isSelected ? 'rgba(255,140,0,0.1)' : 'transparent',
                  color: isSelected ? '#FF8C00' : 'var(--text-2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Proyecto Legacy {i + 1}
              </a>
            );
          })}
        </div>
      )}

      {/* Active contract view */}
      {contractToShow ? (
        <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 16 }}>
              {contractToShow.status === 'active' ? 'Plan activo' : 'Contrato de mantenimiento'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Tier', value: formatTierLabel(contractToShow.tier) },
                { label: 'Precio', value: formatMoneyCents(contractToShow.monthlyPriceCents) + '/mes' },
                { label: 'Cambios incluidos', value: formatTierChanges(contractToShow.tier) ?? 'Ver contrato' },
                { label: 'Facturación', value: formatBillingMethod(contractToShow.billingMethod) },
                {
                  label: 'Hosting',
                  value: contractToShow.hostingIncluded
                    ? `Incluido (+${formatMoneyCents(contractToShow.hostingPriceCents)}/mes)`
                    : 'No incluido',
                },
                {
                  label: 'Inicio',
                  value: new Date(contractToShow.startedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }),
                },
                ...(contractToShow.nextBillingAt
                  ? [{
                      label: 'Próximo cobro',
                      value: new Date(contractToShow.nextBillingAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }),
                    }]
                  : []),
                ...(contractToShow.paypalSubscriptionId
                  ? [{ label: 'Suscripción', value: contractToShow.paypalSubscriptionId.slice(0, 12) + '…' }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 16px' }} />

            {contractToShow.status === 'cancelled' && (
              <div style={{ fontSize: 12, color: '#F87171', fontFamily: 'var(--font-body)', marginBottom: 10 }}>
                Este contrato no está activo actualmente.
              </div>
            )}
            {contractToShow.status === 'paused' && (
              <div style={{ fontSize: 12, color: '#FF8C00', fontFamily: 'var(--font-body)', marginBottom: 10 }}>
                Este contrato está pausado.
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)', marginBottom: 14 }}>
              Para modificar o cancelar tu plan, escríbele a Xavier directamente.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={WA_MODIFY}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  borderRadius: 8,
                  background: '#25D366',
                  color: '#fff',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Solicitar cambio por WhatsApp
              </a>
              <a
                href={WA_CANCEL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'transparent',
                  color: '#F87171',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Hablar sobre cancelación
              </a>
            </div>
          </div>
        </>
      ) : (
        /* No contract → conceptual offer */
        <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>
              Sin plan de mantenimiento activo
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', marginBottom: 20 }}>
              Los planes de mantenimiento Legacy te permiten mantener tu sitio actualizado y seguro con cambios periódicos incluidos. Para activar uno, escríbele a Xavier.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
              {OFFER_PLANS.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                    padding: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#FF8C00', fontFamily: 'var(--font-display)', marginBottom: 6 }}>
                    {p.price}
                  </div>
                  <div style={{ fontSize: 11, color: '#5DD69C', fontFamily: 'var(--font-body)', marginBottom: 8, fontWeight: 600 }}>
                    {p.changes}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Hosting add-on */}
            <div
              style={{
                background: 'rgba(107,159,255,0.06)',
                borderRadius: 10,
                padding: '12px 16px',
                border: '1px solid rgba(107,159,255,0.15)',
                marginBottom: 20,
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                Hosting básico gestionado
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B9FFF', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                +$20/mes
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
                Xavier gestiona la configuración y seguimiento del hosting básico. Costos de proveedor externo o necesidades especiales se confirman caso a caso.
              </div>
            </div>

            <div
              style={{
                background: 'rgba(128,128,128,0.05)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 20,
                fontSize: 11,
                color: 'var(--text-3)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Para hosting personalizado se genera una cotización. Escríbele a Xavier para discutir los detalles.
            </div>

            <a
              href={WA_ACTIVATE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: '#25D366',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: 9,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Activar plan por WhatsApp
            </a>
          </div>
        </>
      )}
    </div>
  );
}
