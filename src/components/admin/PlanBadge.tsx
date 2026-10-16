export type Plan = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';

// Maps plan to design-system badge class from globals.css
const PLAN_BADGE_CLASS: Record<Plan, string> = {
  BASIC:    'badge-neutral',
  PRO:      'badge-pro',
  BUSINESS: 'badge-business',
  LEGACY:   'badge-legacy',
};

const PLAN_PRICES: Record<Plan, string> = {
  BASIC:    '$49',
  PRO:      '$89',
  BUSINESS: '$139',
  LEGACY:   'Custom',
};

interface PlanBadgeProps {
  plan: Plan;
  showPrice?: boolean;
  /** Si se pasa, sobreescribe el precio del plan */
  priceCents?: number;
  className?: string;
}

export function PlanBadge({ plan, showPrice = false, priceCents, className }: PlanBadgeProps) {
  const priceLabel = priceCents
    ? `$${(priceCents / 100).toFixed(0)}`
    : PLAN_PRICES[plan];

  const badgeClass = PLAN_BADGE_CLASS[plan] ?? 'badge-neutral';

  return (
    <span className={`badge-pill ${badgeClass}${className ? ` ${className}` : ''}`}>
      {plan}
      {showPrice && <span className="ml-1 opacity-70">{priceLabel}/mo</span>}
    </span>
  );
}
