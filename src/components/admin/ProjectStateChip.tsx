const ADMIN_STATE_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:                  { label: 'Borrador',          color: 'border-white/10 bg-white/5 text-white/40' },
  AWAITING_ASSETS:        { label: 'Esp. materiales',   color: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
  ASSETS_UNDER_REVIEW:    { label: 'Rev. materiales',   color: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
  PRODUCTION_STARTED:     { label: 'En producción',     color: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
  STAGING_REVIEW:         { label: 'En staging',        color: 'border-purple-500/20 bg-purple-500/10 text-purple-400' },
  REVISIONS:              { label: 'Revisiones',        color: 'border-purple-500/20 bg-purple-500/10 text-purple-400' },
  AWAITING_DEPLOYMENT:    { label: 'Pend. deploy',      color: 'border-blue-500/20 bg-blue-500/10 text-blue-400' },
  LIVE:                   { label: 'En vivo',           color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  MAINTENANCE_PERIOD:     { label: 'Mantenimiento',     color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  REVISION_WINDOW_OPEN:   { label: 'Ventana abierta',   color: 'border-green-500/20 bg-green-500/10 text-green-400' },
  REVISION_WINDOW_CLOSED: { label: 'Ventana cerrada',   color: 'border-white/10 bg-white/5 text-white/40' },
  CLOSED:                 { label: 'Completado',        color: 'border-white/10 bg-white/5 text-white/40' },
  SUSPENDED:              { label: 'Suspendido',        color: 'border-red-500/20 bg-red-500/10 text-red-400' },
  CANCELLED:              { label: 'Cancelado',         color: 'border-red-500/20 bg-red-500/10 text-red-400' },
  CHURN_RISK:             { label: 'Riesgo churn',      color: 'border-red-500/20 bg-red-500/10 text-red-400' },
  PAYMENT_FAILED:         { label: 'Pago fallido',      color: 'border-red-500/20 bg-red-500/10 text-red-400' },
};

interface ProjectStateChipProps {
  state: string;
  isLegacy?: boolean;
  className?: string;
}

export function ProjectStateChip({ state, isLegacy = false, className = '' }: ProjectStateChipProps) {
  const config = ADMIN_STATE_LABELS[state] ?? { label: state, color: 'border-white/10 bg-white/5 text-white/40' };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`px-2 py-0.5 rounded-full text-xs font-['Space_Grotesk'] font-semibold border ${config.color}`}>
        {config.label}
      </span>
      {isLegacy && (
        <span className="px-1.5 py-0.5 rounded text-xs font-['Space_Grotesk'] font-bold bg-[#d5ff02]/10 text-[#d5ff02] border border-[#d5ff02]/20">
          LEGACY
        </span>
      )}
    </div>
  );
}
