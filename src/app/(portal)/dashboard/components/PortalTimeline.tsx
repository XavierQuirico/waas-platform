import type { StepItem } from '@/lib/portal/dashboard-state';

interface PortalTimelineProps {
  steps: StepItem[];
  currentStep: number; // 1-indexed
}

export function PortalTimeline({ steps, currentStep }: PortalTimelineProps) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;

        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: i < steps.length - 1 ? 4 : 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: done ? 'var(--amber)' : active ? 'rgba(255,140,0,0.15)' : 'var(--surface-2)',
                  border: active
                    ? '2px solid var(--amber)'
                    : done
                      ? 'none'
                      : '1px solid rgba(128,128,128,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {done && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#121212"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {active && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--amber)',
                    }}
                  />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    width: 1,
                    height: 24,
                    background: done ? 'rgba(255,140,0,0.4)' : 'rgba(128,128,128,0.2)',
                    marginTop: 2,
                  }}
                />
              )}
            </div>
            <div style={{ paddingTop: 1, paddingBottom: i < steps.length - 1 ? 0 : 0 }}>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-body)',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : done ? 'var(--text-2)' : 'var(--text-3)',
                  display: 'block',
                }}
              >
                {step.label}
              </span>
              {active && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--amber)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                  }}
                >
                  En curso
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
