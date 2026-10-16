'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TicketRow } from './TicketsPageClient';

type PaymentActions = {
  recordManualTicketPayment: (
    ticketId: string,
    input: {
      acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
      expectedQuoteRevision: number;
      paidAmountCents: number;
      paidCurrency: 'USD';
      paidAt: Date;
      paymentMethod: 'bank_transfer' | 'cash' | 'paypal_external' | 'other';
      paymentReference?: string;
      confirmExplicit: true;
      quoteScope?: string;
      priceCents?: number;
      validityDays?: number;
    },
  ) => Promise<{ ok: boolean }>;
  reconcileTicketPayPalPayment: (ticketId: string) => Promise<{
    ok: boolean;
    alreadyPaid?: boolean;
    status?: string;
    message?: string;
  }>;
};

const ACCEPTANCE_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'in_person', label: 'En persona' },
  { value: 'other', label: 'Otro' },
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'paypal_external', label: 'PayPal (fuera del portal)' },
  { value: 'other', label: 'Otro' },
];

const METHODS_REQUIRING_REF = new Set(['bank_transfer', 'paypal_external', 'other']);

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

function buttonStyle(variant: 'primary' | 'secondary' | 'green' | 'danger'): React.CSSProperties {
  const map = {
    primary: { background: 'rgba(255,140,0,0.14)', border: '1px solid rgba(255,140,0,0.35)', color: 'var(--amber)' },
    secondary: { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' },
    green: { background: 'rgba(93,214,156,0.14)', border: '1px solid rgba(93,214,156,0.35)', color: 'var(--green)' },
    danger: { background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red)' },
  }[variant];
  return { ...map, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", display: 'inline-flex', alignItems: 'center', gap: 4 };
}

function formatUSD(cents: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | Date | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TicketPaymentPanel({ ticket, actions }: { ticket: TicketRow; actions: PaymentActions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');

  // Manual payment form state
  const [acceptSource, setAcceptSource] = useState<'whatsapp' | 'phone' | 'in_person' | 'other'>('whatsapp');
  const [paidAmountCents, setPaidAmountCents] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'paypal_external' | 'other'>('bank_transfer');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Create-quote-on-the-fly fields (for no-quote tickets)
  const [newScope, setNewScope] = useState('');
  const [newPriceCents, setNewPriceCents] = useState('');

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

  const isPaidStatus = ticket.status === 'PAID';
  const hasPaypalOrder = !!ticket.paypalOrderId;
  const needsNewQuote = ['none', 'requested', 'needs_info'].includes(ticket.quoteStatus ?? '');
  const canManualPay = !isPaidStatus && !hasPaypalOrder
    && !['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(ticket.status);
  const canReconcile = hasPaypalOrder && ticket.status === 'PAYMENT_PENDING';

  const needsRef = METHODS_REQUIRING_REF.has(paymentMethod);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Current payment info */}
      {isPaidStatus && (
        <div style={{ background: 'rgba(93,214,156,0.08)', border: '1px solid rgba(93,214,156,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>Pagado</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-2)' }}>
            <span>Monto: {formatUSD(ticket.paidAmountCents)}</span>
            <span>Fecha: {formatDate(ticket.paidAt)}</span>
            <span>Método: {ticket.paymentMethod ?? '-'}</span>
            {ticket.paymentReference && <span>Referencia: {ticket.paymentReference}</span>}
          </div>
        </div>
      )}

      {/* PayPal Order info */}
      {hasPaypalOrder && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
          <div style={{ color: 'var(--text-3)', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>PayPal Order</div>
          <div style={{ fontFamily: 'monospace', color: 'var(--text-2)', wordBreak: 'break-all', fontSize: 11 }}>{ticket.paypalOrderId}</div>
          <div style={{ color: 'var(--text-3)', marginTop: 4 }}>
            Monto: {formatUSD(ticket.paypalOrderAmountCents)} · Rev. #{ticket.paypalOrderQuoteRevision ?? '-'}
          </div>
        </div>
      )}

      {/* Reconcile PayPal */}
      {canReconcile && (
        <div style={{ border: '1px solid rgba(255,140,0,0.25)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
            Hay una orden PayPal activa. Si el cliente ya pagó, reconcilia para marcar como PAID.
          </div>
          <button
            style={buttonStyle('primary')}
            disabled={isPending}
            onClick={() => run(
              async () => {
                const result = await actions.reconcileTicketPayPalPayment(ticket.id);
                if (!result.ok && result.message) throw new Error(result.message);
              },
              'PayPal reconciliado — ticket marcado como PAID.',
            )}
          >
            Reconciliar PayPal
          </button>
        </div>
      )}

      {/* Manual payment form */}
      {canManualPay && (
        <details style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            Registrar pago manual / fuera del portal
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <label style={labelStyle}>Aceptación fue por*</label>
            <select value={acceptSource} onChange={(e) => setAcceptSource(e.target.value as typeof acceptSource)} style={fieldStyle}>
              {ACCEPTANCE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {needsNewQuote && (
              <>
                <div style={{ fontSize: 11, color: 'var(--amber)', padding: '6px 8px', background: 'rgba(255,140,0,0.07)', borderRadius: 6, marginTop: 4 }}>
                  Sin cotización formal. Ingresa alcance y precio acordado.
                </div>
                <label style={labelStyle}>Alcance acordado (mín. 20 caracteres)*</label>
                <textarea value={newScope} onChange={(e) => setNewScope(e.target.value)} rows={3} style={fieldStyle} />
                <label style={labelStyle}>Precio acordado en centavos (ej: 29900)*</label>
                <input type="number" value={newPriceCents} onChange={(e) => setNewPriceCents(e.target.value)} style={fieldStyle} min="1" />
              </>
            )}

            <label style={labelStyle}>Monto pagado en centavos (ej: 29900 = $299)*</label>
            <input type="number" value={paidAmountCents} onChange={(e) => setPaidAmountCents(e.target.value)} style={fieldStyle} min="1" />
            <label style={labelStyle}>Fecha de pago*</label>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={fieldStyle} />
            <label style={labelStyle}>Método de pago*</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} style={fieldStyle}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {needsRef && (
              <>
                <label style={labelStyle}>Referencia (obligatoria)*</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} style={fieldStyle} placeholder="Nro. transferencia, ID transacción..." maxLength={200} />
              </>
            )}
            <label style={{ ...labelStyle, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Confirmo que recibí este pago fuera del portal y la información es correcta
            </label>
            <button
              style={buttonStyle('green')}
              disabled={isPending || !confirmed || !paidAmountCents || !paidAt || (needsRef && !reference.trim())}
              onClick={() => run(
                () => actions.recordManualTicketPayment(ticket.id, {
                  acceptanceSource: acceptSource,
                  expectedQuoteRevision: ticket.quoteRevision,
                  paidAmountCents: parseInt(paidAmountCents, 10),
                  paidCurrency: 'USD',
                  paidAt: new Date(paidAt),
                  paymentMethod,
                  paymentReference: reference.trim() || undefined,
                  confirmExplicit: true,
                  quoteScope: newScope.trim() || undefined,
                  priceCents: newPriceCents ? parseInt(newPriceCents, 10) : undefined,
                }),
                'Pago manual registrado — ticket marcado como PAID.',
              )}
            >
              Registrar pago
            </button>
          </div>
        </details>
      )}

      {msg && (
        <div style={{
          fontSize: 12,
          color: msg.includes('Error') || msg.includes('error') || msg.includes('No') ? 'var(--red)' : 'var(--green)',
          padding: '6px 8px',
          borderRadius: 6,
          background: 'var(--surface)',
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
