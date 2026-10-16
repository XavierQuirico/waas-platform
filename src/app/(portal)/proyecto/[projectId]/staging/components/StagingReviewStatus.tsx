import {
  getPortalStagingCopy,
  type PortalStagingVisualState,
} from '@/lib/portal/staging-state';

const BADGE_STYLES: Record<PortalStagingVisualState, string> = {
  ready: 'bg-blue-500/15 text-blue-300',
  approved: 'bg-green-500/15 text-green-300',
  feedback_sent: 'bg-violet-500/15 text-violet-300',
  revisions_in_progress: 'bg-amber-500/15 text-amber-300',
  revisions_done: 'bg-teal-500/15 text-teal-300',
  live: 'bg-green-500/15 text-green-300',
  closed: 'bg-white/10 text-white/50',
  unavailable: 'bg-white/10 text-white/30',
};

interface StagingReviewStatusProps {
  state: PortalStagingVisualState;
  deadline: Date | null;
  feedbackCount: number;
  lastSubmittedAt: Date | null;
}

export function StagingReviewStatus({
  state,
  deadline,
}: StagingReviewStatusProps) {
  const copy = getPortalStagingCopy(state);
  const now = new Date();
  const deadlinePassed = deadline !== null && deadline < now;

  return (
    <div className="space-y-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[state]}`}
      >
        {copy.badge}
      </span>
      <h1 className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        {copy.title}
      </h1>
      <p className="text-sm text-white/50">{copy.description}</p>

      {deadline && (
        <p className="text-xs text-white/30">
          {deadlinePassed
            ? 'La ventana inicial de revisión venció. Aún así puedes enviar tu feedback si el portal lo permite.'
            : `Ventana de revisión: hasta ${deadline.toLocaleDateString('es-DO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}.`}
        </p>
      )}
    </div>
  );
}
