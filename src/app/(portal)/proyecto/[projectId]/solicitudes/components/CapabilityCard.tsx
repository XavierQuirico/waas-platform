'use client';

import type { PortalCapabilityCard } from '@/lib/catalog/portal-types';

const DECISION_BADGES: Record<string, { label: string; color: string }> = {
  included_setup:               { label: 'Incluido',       color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  included_allowance:           { label: 'Incluido',       color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  included_warranty:            { label: 'Garantía',       color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  paid_addon:                   { label: 'Con costo',      color: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
  quote_required:               { label: 'Cotización',     color: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
  partial_available:            { label: 'Parcial',        color: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' },
  unavailable:                  { label: 'No disponible',  color: 'border-white/10 bg-white/5 text-white/30' },
  blocked_duplicate:            { label: 'Ya entregado',   color: 'border-white/10 bg-white/5 text-white/30' },
  blocked_disabled:             { label: 'No disponible',  color: 'border-white/10 bg-white/5 text-white/20' },
  blocked_project_closed:       { label: 'Proyecto cerrado', color: 'border-white/10 bg-white/5 text-white/20' },
  blocked_invalid_project_state:{ label: 'No disponible',  color: 'border-white/10 bg-white/5 text-white/20' },
  blocked_missing_dependency:   { label: 'Requiere otro',  color: 'border-white/10 bg-white/5 text-white/20' },
  blocked_conflict:             { label: 'Incompatible',   color: 'border-white/10 bg-white/5 text-white/20' },
  blocked_request_kind:         { label: 'No aplica',      color: 'border-white/10 bg-white/5 text-white/20' },
};

interface CapabilityCardProps {
  card: PortalCapabilityCard;
  onRequest: (card: PortalCapabilityCard) => void;
}

export function CapabilityCard({ card, onRequest }: CapabilityCardProps) {
  const isBlocked = card.nextAction === 'blocked' || card.decision === 'unavailable';
  const badge = DECISION_BADGES[card.decision] ?? { label: 'Desconocido', color: 'border-white/10 text-white/30' };

  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-150 ${
        isBlocked
          ? 'border-white/5 bg-[#0A0B0F] opacity-55'
          : 'border-white/10 bg-[#0F1014] hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${isBlocked ? 'text-white/40' : 'text-white/80'}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {card.publicName}
          </p>
          {card.publicDescription && (
            <p className="mt-1 text-xs leading-relaxed text-white/30">
              {card.publicDescription}
            </p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] ${badge.color}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-white/25">
          {card.priceCents != null && card.decision === 'paid_addon' && (
            <span>${(card.priceCents / 100).toFixed(0)}</span>
          )}
          {card.includedRemaining != null && card.includedRemaining > 0 && (
            <span>
              {card.includedRemaining} disponible{card.includedRemaining !== 1 ? 's' : ''}
            </span>
          )}
          {card.listPriceCents > 0 && card.decision !== 'paid_addon' && !isBlocked && (
            <span className="text-white/15">
              Valor ${(card.listPriceCents / 100).toFixed(0)}
            </span>
          )}
        </div>

        {!isBlocked ? (
          <button
            onClick={() => onRequest(card)}
            className="rounded-md border border-white/15 px-3 py-1 text-xs font-medium text-white/60 transition-colors duration-150 hover:border-white/25 hover:bg-white/5 hover:text-white/80"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Solicitar
          </button>
        ) : (
          <span className="text-xs text-white/15">No disponible</span>
        )}
      </div>
    </div>
  );
}
