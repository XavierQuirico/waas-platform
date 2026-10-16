'use client';

import * as React from 'react';
import { whatsappUrl } from '@/lib/config/contact';

interface Props {
  clientName: string;
  businessName: string;
  projectContext: string | null;
}

const WA_BASE = whatsappUrl();

const TOPICS = [
  'Proyecto',
  'Mi sitio',
  'Facturación',
  'Incidencia',
  'Cambio o mejora',
  'Otro',
] as const;

export function SoporteContact({ clientName, businessName, projectContext }: Props) {
  const [topic, setTopic] = React.useState<string | null>(null);

  function buildWaHref(topicOverride?: string): string {
    const t = topicOverride ?? topic;
    const base = businessName?.trim()
      ? `Hola, soy ${clientName} de ${businessName}.`
      : `Hola, soy ${clientName}.`;
    const topicPart = t ? ` Tengo una consulta sobre: ${t}.` : '';
    const contextPart = projectContext ? ` ${projectContext}` : '';
    const msg = `${base}${topicPart}${contextPart} ¿Puedes ayudarme?`;
    return `${WA_BASE}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,140,0,0.07) 0%, transparent 100%)',
        border: '1px solid rgba(255,140,0,0.18)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
      }}
    >
      {/* Contact header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(255,140,0,0.16)',
            border: '1px solid rgba(255,140,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            color: '#FF8C00',
            letterSpacing: '-0.02em',
          }}
        >
          XQ
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
            Xavier Quirico
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-body)' }}>
            QUIRICO STUDIOS · hola@quiricostudios.com
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16, fontFamily: 'var(--font-body)' }}>
        Para dudas rápidas o casos que prefieres explicar directamente, WhatsApp es la vía más simple.
      </p>

      {/* Topic selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'var(--font-body)' }}>
          Tema (opcional)
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(topic === t ? null : t)}
              style={{
                padding: '5px 12px',
                borderRadius: 100,
                border: `1px solid ${topic === t ? '#FF8C00' : 'rgba(128,128,128,0.2)'}`,
                background: topic === t ? 'rgba(255,140,0,0.1)' : 'transparent',
                color: topic === t ? '#FF8C00' : 'var(--text-2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 11,
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {topic && (
        <div
          style={{
            marginBottom: 14,
            padding: '8px 12px',
            background: 'rgba(128,128,128,0.06)',
            borderRadius: 7,
            fontSize: 11,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-body)',
          }}
        >
          El mensaje incluirá el contexto:{' '}
          <strong style={{ color: 'var(--text-2)' }}>&ldquo;{topic}&rdquo;</strong>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a
          href={buildWaHref()}
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
            padding: '10px 16px',
            borderRadius: 9,
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
  );
}
