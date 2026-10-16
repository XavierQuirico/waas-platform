'use client';

import type { ClientTicket } from '@/lib/catalog/portal-types';

const STATUS_LABELS: Record<string, string> = {
  draft:            'Borrador',
  submitted:        'Enviado',
  included:         'Incluido',
  quote_requested:  'Cotización solicitada',
  quote_needs_info: 'Más información',
  quote_priced:     'Cotización lista',
  quote_declined:   'Cotización declinada',
  payment_pending:  'Pendiente de pago',
  paid:             'Pagado',
  in_progress:      'En progreso',
  delivered:        'Entregado',
  rejected:         'Rechazado',
  cancelled:        'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  draft:            'border-white/10 bg-white/5 text-white/40',
  submitted:        'border-blue-500/20 bg-blue-500/10 text-blue-400',
  included:         'border-green-500/20 bg-green-500/10 text-green-400',
  quote_requested:  'border-amber-500/20 bg-amber-500/10 text-amber-400',
  quote_needs_info: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  quote_priced:     'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
  quote_declined:   'border-red-500/20 bg-red-500/10 text-red-400',
  payment_pending:  'border-amber-500/20 bg-amber-500/10 text-amber-400',
  paid:             'border-green-500/20 bg-green-500/10 text-green-400',
  in_progress:      'border-blue-500/20 bg-blue-500/10 text-blue-400',
  delivered:        'border-green-500/20 bg-green-500/10 text-green-400',
  rejected:         'border-red-500/20 bg-red-500/10 text-red-400',
  cancelled:        'border-white/10 bg-white/5 text-white/30',
};

interface TicketListProps {
  tickets: ClientTicket[];
}

export function TicketList({ tickets }: TicketListProps) {
  if (tickets.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xs font-medium text-white/40 uppercase tracking-[0.08em]">
        Tus solicitudes
      </h2>
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-lg border border-white/10 bg-[#0F1014] px-4 py-3 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-white/80"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {ticket.title}
                </p>
                {ticket.addonPublicName && (
                  <p className="mt-0.5 text-xs text-white/30">
                    {ticket.addonPublicName}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] ${STATUS_COLORS[ticket.clientStatus] ?? 'border-white/10 text-white/30'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {STATUS_LABELS[ticket.clientStatus] ?? ticket.clientStatus}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-white/20">
              <span>{ticket.ticketNumber}</span>
              <span>
                {new Date(ticket.createdAt).toLocaleDateString('es-DO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {ticket.priceAmount > 0 && (
                <span className="text-white/40">${(ticket.priceAmount / 100).toFixed(2)}</span>
              )}
              {ticket.quoteStatus === 'requested' && (
                <span className="text-amber-400/60">· En cotización</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
