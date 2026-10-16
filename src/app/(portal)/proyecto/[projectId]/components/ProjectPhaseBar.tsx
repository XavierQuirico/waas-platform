import type { ProjectPhaseItem } from '@/lib/portal/dashboard-state';

interface ProjectPhaseBarProps {
  phases: ProjectPhaseItem[];
  currentIndex: number;
}

const BADGE_COLORS: Record<string, { dot: string; text: string; line: string }> = {
  done: {
    dot: '#5DD69C',
    text: 'rgba(249,249,249,0.5)',
    line: '#5DD69C',
  },
  current: {
    dot: '#FF8C00',
    text: '#FF8C00',
    line: 'rgba(255,255,255,0.08)',
  },
  pending: {
    dot: 'rgba(255,255,255,0.08)',
    text: 'rgba(249,249,249,0.25)',
    line: 'rgba(255,255,255,0.08)',
  },
};

export function ProjectPhaseBar({ phases, currentIndex }: ProjectPhaseBarProps) {
  return (
    <div
      className="flex items-start gap-0 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
      aria-label="Progreso del proyecto"
    >
      {phases.map((phase, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        const state = isDone ? 'done' : isCurrent ? 'current' : 'pending';
        const colors = BADGE_COLORS[state];

        return (
          <div key={i} className="flex items-start" style={{ flexShrink: 0 }}>
            {/* Phase node */}
            <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 60 }}>
              {/* Dot */}
              <div
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 22,
                  height: 22,
                  background: isDone ? colors.dot : isCurrent ? 'transparent' : colors.dot,
                  border: isCurrent ? `2px solid ${colors.dot}` : 'none',
                  flexShrink: 0,
                }}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {isCurrent && (
                  <div
                    style={{ width: 7, height: 7, borderRadius: '50%', background: colors.dot }}
                  />
                )}
                {!isDone && !isCurrent && (
                  <div
                    style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}
                  />
                )}
              </div>
              {/* Label */}
              <span
                className="text-center leading-tight"
                style={{
                  fontSize: 9,
                  color: colors.text,
                  fontWeight: isCurrent ? 700 : 400,
                  letterSpacing: '0.02em',
                  maxWidth: 56,
                }}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector line */}
            {i < phases.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  minWidth: 8,
                  background: i < currentIndex ? '#5DD69C' : 'rgba(255,255,255,0.08)',
                  marginTop: 10,
                  alignSelf: 'flex-start',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
