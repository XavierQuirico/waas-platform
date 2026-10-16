'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TicketDetailData, PublicTicketEvent } from '../actions';
import { acceptTicketQuote, declineTicketQuote } from '../actions';
import { TicketPayPalCheckout } from './TicketPayPalCheckout';

// ─── Helpers ───────────────────────────────────────────────

function formatMoney(cents: number | null, currency = 'USD'): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(0)} ${currency}`;
}

function formatDate(d: Date | null | string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(d: Date | null | string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpired(quoteExpiresAt: Date | null | string): boolean {
  if (!quoteExpiresAt) return false;
  return new Date(quoteExpiresAt) <= new Date();
}

// ─── Event type labels ─────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  STATUS_CHANGED: 'Estado actualizado',
  NOTE_ADDED: 'Nota',
  PRICE_UPDATED: 'Precio actualizado',
  PAYPAL_ORDER_CREATED: 'Orden de pago creada',
  PAYPAL_WEBHOOK_RECEIVED: 'Confirmación PayPal',
  QUOTE_SENT: 'Cotización enviada',
  QUOTE_ACCEPTED: 'Cotización aceptada',
  QUOTE_DECLINED: 'Cotización rechazada',
  QUOTE_EXPIRED: 'Cotización vencida',
  MANUAL_PAYMENT_RECORDED: 'Pago registrado',
  PAYPAL_CAPTURE_COMPLETED: 'Pago confirmado',
  PAYPAL_RECONCILED: 'Pago reconciliado',
};

// ─── Quote card ────────────────────────────────────────────
function QuoteCard({
  ticket,
  onAccept,
  onDecline,
  acting,
}: {
  ticket: TicketDetailData;
  onAccept: () => void;
  onDecline: () => void;
  acting: boolean;
}) {
  if (ticket.quoteStatus === 'none' || ticket.quoteStatus === 'requested') {
    return (
      <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5 mb-6">
        <p className="text-sm text-white/50 font-inter-tight">
          {ticket.quoteStatus === 'requested'
            ? 'Tu solicitud está siendo revisada. Te enviaremos una cotización pronto.'
            : 'Esta solicitud está pendiente de revisión.'}
        </p>
      </div>
    );
  }

  const expired = isExpired(ticket.quoteExpiresAt);

  // PAYMENT_PENDING: pago en tránsito, no mostrar botones PayPal
  if (ticket.clientStatus === 'payment_pending') {
    return (
      <div className="bg-orange-400/[0.06] border border-orange-400/20 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-orange-400 animate-spin" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="30" strokeDashoffset="10" />
          </svg>
          <p className="text-sm font-inter-tight text-orange-300 font-medium">Confirmando pago</p>
        </div>
        <p className="text-xs text-white/50 font-inter-tight">
          Tu pago está siendo confirmado por PayPal. Esto puede tomar unos minutos. No es necesario hacer nada más.
        </p>
      </div>
    );
  }

  // paid / in_progress / delivered / completed — cotización aceptada pero ya pagado o más avanzado
  // NUNCA mostrar PayPal en estos estados aunque quoteStatus === 'accepted'
  if (
    ticket.clientStatus === 'paid' ||
    ticket.clientStatus === 'in_progress' ||
    ticket.clientStatus === 'delivered' ||
    ticket.clientStatus === 'cancelled' ||
    ticket.clientStatus === 'rejected'
  ) {
    return null;
  }

  if (ticket.clientStatus === 'ready_to_pay') {
    // ready_to_pay — cotización aceptada y vigente, mostrar PayPal
    return (
      <div className="bg-orange-400/[0.06] border border-orange-400/20 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <p className="text-sm font-inter-tight text-orange-300 font-medium">Listo para pagar</p>
        </div>
        <p className="text-xs text-white/50 font-inter-tight mb-1">
          Has aceptado esta cotización. Procesa el pago para que iniciemos el trabajo.
        </p>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xl font-clash-grotesk font-bold text-white/90">
            {formatMoney(ticket.quotedPriceCents)}
          </span>
          <a
            href="/soporte"
            className="text-xs text-white/40 font-inter-tight hover:text-white/60 transition-colors"
          >
            ¿Dudas? Escríbenos
          </a>
        </div>
        {ticket.quotedPriceCents && ticket.quotedPriceCents > 0 && (
          <TicketPayPalCheckout
            ticketNumber={ticket.ticketNumber}
            quoteRevision={ticket.quoteRevision}
            quotedPriceCents={ticket.quotedPriceCents}
          />
        )}
      </div>
    );
  }

  if (ticket.quoteStatus === 'priced' && !expired) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-clash-grotesk font-semibold text-white/85">
            Cotización
          </h3>
          <span className="text-xs text-white/35 font-inter-tight">
            Revisión #{ticket.quoteRevision}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-white/40 font-inter-tight">Importe</span>
            <span className="text-lg font-clash-grotesk font-bold text-white/90">
              {formatMoney(ticket.quotedPriceCents)}
            </span>
          </div>

          {ticket.quoteEstimatedBusinessDays && (
            <div className="flex justify-between">
              <span className="text-xs text-white/40 font-inter-tight">Plazo estimado</span>
              <span className="text-xs text-white/65 font-inter-tight">
                {ticket.quoteEstimatedBusinessDays} días hábiles
              </span>
            </div>
          )}

          {ticket.quoteExpiresAt && (
            <div className="flex justify-between">
              <span className="text-xs text-white/40 font-inter-tight">Válida hasta</span>
              <span className="text-xs text-white/65 font-inter-tight">
                {formatDate(ticket.quoteExpiresAt)}
              </span>
            </div>
          )}
        </div>

        {ticket.quoteScope && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-5">
            <p className="text-xs text-white/50 font-inter-tight leading-relaxed whitespace-pre-wrap">
              {ticket.quoteScope}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onAccept}
            disabled={acting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-white text-sm font-inter-tight font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {acting ? 'Procesando…' : 'Aceptar cotización'}
          </button>
          <button
            onClick={onDecline}
            disabled={acting}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm font-inter-tight hover:text-white/75 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Rechazar
          </button>
        </div>
      </div>
    );
  }

  if (ticket.quoteStatus === 'declined') {
    return (
      <div className="bg-neutral-500/[0.06] border border-neutral-500/20 rounded-2xl p-5 mb-6">
        <p className="text-sm text-white/40 font-inter-tight">
          Rechazaste esta cotización. Si cambias de opinión, escríbenos.
        </p>
        <a href="/soporte" className="mt-3 inline-block text-xs text-white/30 font-inter-tight hover:text-white/50 transition-colors">
          Contactar →
        </a>
      </div>
    );
  }

  if (ticket.clientStatus === 'quote_expired' || expired) {
    return (
      <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-5 mb-6">
        <p className="text-sm text-red-300/80 font-inter-tight">
          Esta cotización venció el {formatDate(ticket.quoteExpiresAt)}. Contáctanos para solicitar una nueva.
        </p>
        <a href="/soporte" className="mt-3 inline-block text-xs text-red-300/50 font-inter-tight hover:text-red-300/70 transition-colors">
          Solicitar nueva cotización →
        </a>
      </div>
    );
  }

  return null;
}

// ─── Payment confirmation card ─────────────────────────────
function PaymentCard({ ticket }: { ticket: TicketDetailData }) {
  if (!ticket.paidAt) return null;

  return (
    <div className="bg-emerald-400/[0.06] border border-emerald-400/20 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <p className="text-sm font-inter-tight text-emerald-300 font-medium">Pago confirmado</p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-xs text-white/40 font-inter-tight">Importe</span>
          <span className="text-xs text-white/70 font-inter-tight">
            {formatMoney(ticket.paidAmountCents, ticket.paidCurrency ?? 'USD')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-white/40 font-inter-tight">Fecha</span>
          <span className="text-xs text-white/70 font-inter-tight">{formatDate(ticket.paidAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline ──────────────────────────────────────────────
function Timeline({ events }: { events: PublicTicketEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-inter-tight text-white/30 uppercase tracking-widest mb-4 px-1">
        Actividad
      </h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />

        <div className="space-y-4">
          {events.map((ev) => (
            <div key={ev.id} className="flex gap-4 items-start">
              <div className="relative z-10 mt-0.5">
                <div className="w-3.5 h-3.5 rounded-full bg-[#181920] border border-white/15 flex-shrink-0" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs text-white/65 font-inter-tight">
                    {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                  </span>
                  <span className="text-xs text-white/25 font-inter-tight flex-shrink-0">
                    {formatDateShort(ev.createdAt)}
                  </span>
                </div>
                {ev.note && (
                  <p className="text-xs text-white/40 font-inter-tight leading-relaxed mt-1">
                    {ev.note}
                  </p>
                )}
                {ev.amountCents && (
                  <p className="text-xs text-white/35 font-inter-tight mt-1">
                    {formatMoney(ev.amountCents, ev.currency ?? 'USD')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Decline modal ─────────────────────────────────────────
function DeclineModal({
  onConfirm,
  onCancel,
  acting,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  acting: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#111218] border border-white/[0.08] rounded-2xl w-full max-w-md p-6">
        <h3 className="text-sm font-clash-grotesk font-semibold text-white/85 mb-2">
          Rechazar cotización
        </h3>
        <p className="text-xs text-white/40 font-inter-tight mb-4">
          Opcionalmente puedes dejarnos saber el motivo. Nos ayuda a mejorar.
        </p>
        <textarea
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/75 font-inter-tight resize-none focus:outline-none focus:border-white/20 placeholder:text-white/20 mb-4"
          rows={3}
          maxLength={500}
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(reason)}
            disabled={acting}
            className="flex-1 py-2.5 rounded-xl bg-red-500/70 hover:bg-red-500/90 text-white text-sm font-inter-tight transition-colors disabled:opacity-50"
          >
            {acting ? 'Enviando…' : 'Confirmar rechazo'}
          </button>
          <button
            onClick={onCancel}
            disabled={acting}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm font-inter-tight hover:border-white/20 hover:text-white/70 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detalle principal ────────────────────────────────────
export function TicketDetailClient({ ticket }: { ticket: TicketDetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptTicketQuote(ticket.id, ticket.quoteRevision);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? 'Error desconocido');
      }
    });
  }

  function handleDeclineConfirm(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await declineTicketQuote(ticket.id, ticket.quoteRevision, reason);
      if (result.ok) {
        setShowDeclineModal(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Error desconocido');
        setShowDeclineModal(false);
      }
    });
  }

  return (
    <>
      {showDeclineModal && (
        <DeclineModal
          onConfirm={handleDeclineConfirm}
          onCancel={() => setShowDeclineModal(false)}
          acting={isPending}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/cambios-y-mejoras"
          className="inline-flex items-center gap-1.5 text-xs text-white/30 font-inter-tight hover:text-white/55 transition-colors mb-6"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Cambios y mejoras
        </Link>

        {/* Ticket header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/30 font-inter-tight tabular-nums">
              {ticket.ticketNumber}
            </span>
            {ticket.addonPublicName && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-xs text-white/30 font-inter-tight">{ticket.addonPublicName}</span>
              </>
            )}
          </div>
          <h1 className="text-lg font-clash-grotesk font-bold text-white/90 leading-snug mb-1">
            {ticket.title}
          </h1>
          <p className="text-xs text-white/30 font-inter-tight">
            Solicitado el {formatDate(ticket.createdAt)}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-300 font-inter-tight">{error}</p>
          </div>
        )}

        {/* Payment confirmation */}
        <PaymentCard ticket={ticket} />

        {/* Quote card */}
        <QuoteCard
          ticket={ticket}
          onAccept={handleAccept}
          onDecline={() => setShowDeclineModal(true)}
          acting={isPending}
        />

        {/* Description */}
        {ticket.description && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 mb-6">
            <h3 className="text-xs font-inter-tight text-white/30 uppercase tracking-widest mb-3">
              Descripción
            </h3>
            <p className="text-sm text-white/60 font-inter-tight leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>
        )}

        {/* Timeline */}
        <Timeline events={ticket.events} />
      </div>
    </>
  );
}
