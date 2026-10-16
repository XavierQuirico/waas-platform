import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── SlaBadge (dark-theme admin, inline dot indicator) ──────────────────────

interface SlaBadgeProps {
  hoursRemaining: number;
  projectName?: string;
}

export function SlaBadge({ hoursRemaining }: SlaBadgeProps) {
  if (hoursRemaining > 48) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-green-500/20 bg-green-500/10 text-green-400 font-['Inter_Tight']">
        <span className="w-1 h-1 rounded-full bg-green-400" />
        Vence en {Math.round(hoursRemaining)}h
      </span>
    );
  }

  if (hoursRemaining > 12) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-amber-500/20 bg-amber-500/10 text-amber-400 font-['Inter_Tight']">
        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
        Vence en {Math.round(hoursRemaining)}h
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-red-500/20 bg-red-500/10 text-red-400 font-['Inter_Tight'] font-semibold">
      <span className="w-1 h-1 rounded-full bg-red-400 animate-ping" />
      ¡Vence en {Math.round(hoursRemaining)}h!
    </span>
  );
}

// ─── SLABadge (original — Clock icon + hours text) ──────────────────────────

interface SLABadgeProps {
  /** Horas hábiles restantes hasta el deadline. Null si no hay deadline activo. */
  hoursRemaining: number | null;
  /** Muestra el label "— URGENTE" junto al countdown en estado crítico. Default: true */
  showLabel?: boolean;
  className?: string;
}

type SLALevel = 'critical' | 'warning' | 'ok' | 'none';

function getSLALevel(hours: number | null): SLALevel {
  if (hours === null) return 'none';
  if (hours < 12) return 'critical';
  if (hours < 36) return 'warning';
  return 'ok';
}

function formatHours(hours: number): string {
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

const LEVEL_STYLES: Record<SLALevel, string> = {
  critical: 'bg-red-50 text-red-600 border-red-200',
  warning:  'bg-amber-50 text-amber-600 border-amber-200',
  ok:       'bg-green-50 text-green-600 border-green-200',
  none:     'bg-zinc-50 text-zinc-400 border-zinc-200',
};

export function SLABadge({ hoursRemaining, showLabel = true, className }: SLABadgeProps) {
  const level = getSLALevel(hoursRemaining);

  if (level === 'none') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
          LEVEL_STYLES.none,
          className
        )}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        LEVEL_STYLES[level],
        className
      )}
      title={`${hoursRemaining} horas hábiles restantes`}
    >
      <Clock size={11} strokeWidth={1.5} />
      {formatHours(hoursRemaining!)}
      {showLabel && level === 'critical' && (
        <span className="font-bold">— URGENTE</span>
      )}
    </span>
  );
}
