import type { ProjectStatus } from '@/lib/projects/state-machine';

// Maps each status to the design-system badge class from globals.css
const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  DRAFT:                'badge-neutral',
  PROPOSAL_SENT:        'badge-blue',
  REQUIRES_REVIEW:      'badge-amber',
  PROPOSAL_EXPIRED:     'badge-red',
  PAYMENT_RECEIVED:     'badge-green',
  AWAITING_ASSETS:      'badge-amber',
  ASSETS_SUBMITTED:     'badge-amber',
  ASSETS_UNDER_REVIEW:  'badge-violet',
  ASSETS_INCOMPLETE:    'badge-red',
  PRODUCTION_STARTED:   'badge-violet',
  STAGING_REVIEW:       'badge-violet',
  REVISIONS:            'badge-amber',
  REVISIONS_DONE:       'badge-green',
  LIVE:                 'badge-green',
  SUSPENDED:            'badge-red',
  CANCELLED:            'badge-red',
  CLOSED:               'badge-neutral',
};

interface StatusBadgeProps {
  status: ProjectStatus;
  /** Label amigable (default) o técnico (DevMode) */
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const badgeClass = STATUS_BADGE_CLASS[status] ?? 'badge-neutral';
  return (
    <span className={`badge-pill ${badgeClass}${className ? ` ${className}` : ''}`}>
      {label}
    </span>
  );
}
