'use client';

interface WizardProgressProps {
  currentStep: number; // 1–6 (step 0 is intro, no progress shown)
  totalSteps: number;  // 6
}

const STEP_LABELS = [
  'Contacto',
  'Negocio',
  'Objetivos',
  'Brief',
  'Materiales',
  'Resumen',
];

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
  const percent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
  const stepLabel = STEP_LABELS[currentStep - 1] ?? '';

  return (
    <div>
      {/* Mobile: compact step + name + premium rail */}
      <div className="sm:hidden">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-label font-semibold text-[10px] uppercase tracking-[0.12em] text-white/25">
              Paso
            </span>
            <span className="font-label font-semibold text-[11px] text-white/45">
              {currentStep}
            </span>
            <span className="font-label text-[10px] text-white/20">/</span>
            <span className="font-label text-[10px] text-white/25">{totalSteps}</span>
          </div>
          <span className="font-label font-semibold text-[11px] uppercase tracking-[0.10em] text-[#FF8C00]/70">
            {stepLabel}
          </span>
        </div>
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Paso ${currentStep} de ${totalSteps}: ${stepLabel}`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percent}%`,
              background: 'linear-gradient(90deg, #e07d00, #FF8C00)',
              boxShadow: '0 0 10px rgba(255,140,0,0.40)',
            }}
          />
        </div>
      </div>

      {/* Desktop: circles with segment connectors (line never crosses circles) */}
      <div
        className="hidden sm:block"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Paso ${currentStep} de ${totalSteps}: ${stepLabel}`}
      >
        {/* Top row: circles interleaved with connector segments */}
        <div className="flex items-start">
          {Array.from({ length: totalSteps }, (_, i) => {
            const step = i + 1;
            const isDone = step < currentStep;
            const isCurrent = step === currentStep;
            // Connector before this circle is filled when i < currentStep
            // (the step to the left is done)
            const connectorFilled = i < currentStep;

            return (
              <div key={step} className="contents">
                {i > 0 && (
                  <div className="relative mt-3 flex-1 h-px">
                    <div className="absolute inset-0 bg-white/[0.08]" />
                    {connectorFilled && (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(90deg, #e07d00, #FF8C00)',
                          opacity: 0.45,
                        }}
                      />
                    )}
                  </div>
                )}

                <div className="flex flex-col items-center gap-1.5">
                  {/* Circle */}
                  <div
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                      isDone
                        ? 'bg-[#FF8C00] text-[#121212]'
                        : isCurrent
                        ? 'border-2 border-[#FF8C00]/80 bg-[#0C0D10] text-[#FF8C00]'
                        : 'border border-white/[0.12] bg-[#0C0D10] text-white/20',
                    ].join(' ')}
                    style={isDone ? { boxShadow: '0 0 8px rgba(255,140,0,0.35)' } : undefined}
                  >
                    {isDone ? (
                      <svg
                        className="h-3 w-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="font-label font-semibold text-[10px]">{step}</span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={[
                      'font-label text-[10px] uppercase tracking-[0.07em] whitespace-nowrap transition-colors duration-300',
                      isCurrent
                        ? 'font-semibold text-[#FF8C00]/75'
                        : isDone
                        ? 'text-white/22'
                        : 'text-white/15',
                    ].join(' ')}
                  >
                    {STEP_LABELS[i]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
