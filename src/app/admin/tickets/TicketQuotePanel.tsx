'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketRow } from './TicketsPageClient';

type QuoteActions = {
  sendTicketQuote: (
    ticketId: string,
    input: {
      quoteScope: string;
      priceCents: number;
      validityDays?: number;
      estimatedBusinessDays?: number;
      internalNote?: string;
    },
  ) => Promise<{ ok: boolean; newRevision?: number }>;
  recordTicketQuoteAcceptance: (
    ticketId: string,
    input: {
      acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
      expectedQuoteRevision: number;
      quoteScope?: string;
      priceCents?: number;
      validityDays?: number;
      estimatedBusinessDays?: number;
    },
  ) => Promise<{ ok: boolean }>;
};

const ACCEPTANCE_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'in_person', label: 'En persona' },
  { value: 'other', label: 'Otro' },
];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: "'Inter Tight', sans-serif",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginTop: 8,
  marginBottom: 3,
};

function buttonStyle(variant: 'primary' | 'secondary' | 'green'): React.CSSProperties {
  const map = {
    primary: { background: 'rgba(255,140,0,0.14)', border: '1px solid rgba(255,140,0,0.35)', color: 'var(--amber)' },
    secondary: { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' },
    green: { background: 'rgba(93,214,156,0.14)', border: '1px solid rgba(93,214,156,0.35)', color: 'var(--green)' },
  }[variant];
  return { ...map, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", display: 'inline-flex', alignItems: 'center', gap: 4 };
}

function formatUSD(cents: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TicketQuotePanel({ ticket, actions }: { ticket: TicketRow; actions: QuoteActions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');

  // Send quote form
  const [scope, setScope] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [validityDays, setValidityDays] = useState('7');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [internalNote, setInternalNote] = useState('');

  // Acceptance form
  const [acceptSource, setAcceptSource] = useState<'whatsapp' | 'phone' | 'in_person' | 'other'>('whatsapp');
  const [acceptScope, setAcceptScope] = useState('');
  const [acceptPrice, setAcceptPrice] = useState('');

  function run(fn: () => Promise<unknown>, success: string) {
    setMsg('');
    startTransition(async () => {
      try {
        await fn();
        setMsg(success);
        router.refresh();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Error desconocido.');
      }
    });
  }

  const canSendQuote = !['PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(ticket.status)
    && ticket.quoteStatus !== 'accepted';

  const canRecordAcceptance = ticket.quoteStatus === 'priced'
    || (['none', 'requested', 'needs_info'].includes(ticket.quoteStatus ?? ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Current quote state */}
      {ticket.quotedPriceCents != null && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-3)' }}>Revisión #{ticket.quoteRevision}</span>
            <span style={{ fontWeight: 700, color: 'var(--amber)' }}>{formatUSD(ticket.quotedPriceCents)}</span>
          </div>
          {ticket.quoteScope && <div style={{ color: 'var(--text-2)', marginBottom: 4 }}>{ticket.quoteScope}</div>}
          <div style={{ display: 'flex', gap: 16, color: 'var(--text-3)', fontSize: 11 }}>
            <span>Vence: {formatDate(ticket.quoteExpiresAt)}</span>
            {ticket.quoteEstimatedBusinessDays && <span>Estimado: {ticket.quoteEstimatedBusinessDays} días hábiles</span>}
            {ticket.quoteAcceptanceSource && <span>Aceptado vía: {ticket.quoteAcceptanceSource}</span>}
          </div>
        </div>
      )}

      {/* Send quote form */}
      {canSendQuote && (
        <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
            {ticket.quotedPriceCents ? '↩ Enviar nueva revisión' : '+ Enviar presupuesto'}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <label style={labelStyle}>Alcance público (mín. 20 caracteres)*</label>
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} style={fieldStyle} placeholder="Descripción del trabajo para el cliente..." />
            <label style={labelStyle}>Precio USD (en centavos, ej: 29900 = $299)*</label>
            <input type="number" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} style={fieldStyle} placeholder="29900" min="1" step="1" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>Vigencia (días)</label>
                <input type="number" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} style={fieldStyle} min="1" max="30" />
              </div>
              <div>
                <label style={labelStyle}>Estimado (días hábiles)</label>
                <input type="number" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} style={fieldStyle} min="1" max="60" placeholder="5" />
              </div>
            </div>
            <label style={labelStyle}>Nota interna (no la ve el cliente)</label>
            <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} style={fieldStyle} />
            <button
              style={buttonStyle('primary')}
              disabled={isPending || !scope.trim() || !priceCents}
              onClick={() => run(
                () => actions.sendTicketQuote(ticket.id, {
                  quoteScope: scope.trim(),
                  priceCents: parseInt(priceCents, 10),
                  validityDays: validityDays ? parseInt(validityDays, 10) : 7,
                  estimatedBusinessDays: estimatedDays ? parseInt(estimatedDays, 10) : undefined,
                  internalNote: internalNote.trim() || undefined,
                }),
                'Presupuesto enviado.',
              )}
            >
              Enviar presupuesto
            </button>
          </div>
        </details>
      )}

      {/* Record acceptance from outside portal */}
      {canRecordAcceptance && (
        <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            Registrar aceptación fuera del portal
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <label style={labelStyle}>Canal de aceptación*</label>
            <select value={acceptSource} onChange={(e) => setAcceptSource(e.target.value as typeof acceptSource)} style={fieldStyle}>
              {ACCEPTANCE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {/* If no existing priced quote, need scope+price */}
            {['none', 'requested', 'needs_info'].includes(ticket.quoteStatus ?? '') && (
              <>
                <div style={{ fontSize: 11, color: 'var(--amber)', padding: '6px 8px', background: 'rgba(255,140,0,0.07)', borderRadius: 6 }}>
                  No hay cotización enviada. Ingresa alcance y precio del acuerdo verbal.
                </div>
                <label style={labelStyle}>Alcance acordado (mín. 20 caracteres)*</label>
                <textarea value={acceptScope} onChange={(e) => setAcceptScope(e.target.value)} rows={3} style={fieldStyle} />
                <label style={labelStyle}>Precio acordado en centavos (ej: 29900 = $299)*</label>
                <input type="number" value={acceptPrice} onChange={(e) => setAcceptPrice(e.target.value)} style={fieldStyle} min="1" />
              </>
            )}
            <button
              style={buttonStyle('green')}
              disabled={isPending}
              onClick={() => run(
                () => actions.recordTicketQuoteAcceptance(ticket.id, {
                  acceptanceSource: acceptSource,
                  expectedQuoteRevision: ticket.quoteRevision,
                  quoteScope: acceptScope.trim() || undefined,
                  priceCents: acceptPrice ? parseInt(acceptPrice, 10) : undefined,
                }),
                'Aceptación registrada.',
              )}
            >
              Registrar aceptación
            </button>
          </div>
        </details>
      )}

      {msg && <div style={{ fontSize: 12, color: msg.startsWith('Error') || msg.startsWith('No') ? 'var(--red)' : 'var(--green)', padding: '6px 8px', borderRadius: 6, background: 'var(--surface)' }}>{msg}</div>}
    </div>
  );
}
