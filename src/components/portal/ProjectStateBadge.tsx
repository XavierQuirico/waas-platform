'use client';
import { useEffect, useRef } from 'react';
import { animateStateBadge } from '@/lib/gsap';

// Mapeo de estados a estilos
const STATE_STYLES: Record<string, string> = {
  DRAFT: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  AWAITING_ASSETS: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  ASSETS_UNDER_REVIEW: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  PRODUCTION_STARTED: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  STAGING_REVIEW: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  REVISIONS: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
  LIVE: 'border-green-500/20 bg-green-500/10 text-green-400',
  CLOSED: 'border-white/10 bg-white/5 text-white/40',
  SUSPENDED: 'border-red-500/20 bg-red-500/10 text-red-400',
  CANCELLED: 'border-red-500/20 bg-red-500/10 text-red-400',
};

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  AWAITING_ASSETS: 'Esperando materiales',
  ASSETS_UNDER_REVIEW: 'Revisando materiales',
  PRODUCTION_STARTED: 'En producción',
  STAGING_REVIEW: 'En revisión',
  REVISIONS: 'En revisiones',
  LIVE: 'En vivo',
  CLOSED: 'Completado',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

interface ProjectStateBadgeProps {
  state: string;
  animate?: boolean;
  className?: string;
}

export function ProjectStateBadge({ state, animate = false, className = '' }: ProjectStateBadgeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const styles = STATE_STYLES[state] ?? 'border-white/10 bg-white/5 text-white/40';
  const label = STATE_LABELS[state] ?? state;

  useEffect(() => {
    if (animate && ref.current) {
      animateStateBadge(ref.current);
    }
  }, [state, animate]);

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border font-['Space_Grotesk'] uppercase tracking-[0.08em] ${styles} ${className}`}
    >
      {state === 'LIVE' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      )}
      {label}
    </span>
  );
}
