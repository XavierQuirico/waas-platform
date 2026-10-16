'use client';

// Badge de plan — muestra el plan detectado con color y etiqueta
// Actualizado en tiempo real en Step 3 mientras el cliente selecciona funcionalidades

import type { DetectedPlan } from '@/lib/intake/types';

const PLAN_CONFIG: Record<
  DetectedPlan,
  { label: string; className: string }
> = {
  BASIC: {
    label: 'Plan BASIC',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  PRO: {
    label: 'Plan PRO',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  BUSINESS: {
    label: 'Plan BUSINESS',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  LEGACY: {
    label: 'Propuesta personalizada',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

interface PlanBadgeProps {
  plan: DetectedPlan;
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  const { label, className } = PLAN_CONFIG[plan];

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        'transition-all duration-200',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
