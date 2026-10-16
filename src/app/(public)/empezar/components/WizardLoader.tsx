'use client';

import { useEffect, useState } from 'react';

const MICROCOPY = [
  'Analizando tu solicitud...',
  'Identificando necesidades...',
  'Preparando tu resumen...',
  'Un momento más...',
];

interface WizardLoaderProps {
  complete?: boolean;
}

export function WizardLoader({ complete = false }: WizardLoaderProps) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % MICROCOPY.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (complete) {
      setProgress(100);
      return;
    }
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const phase1 = Math.min(elapsed / 8000, 1) * 90;
      const phase2 = elapsed > 8000 ? Math.min((elapsed - 8000) / 15000, 1) * 5 : 0;
      setProgress(Math.min(95, phase1 + phase2));
    }, 150);
    return () => clearInterval(id);
  }, [complete]);

  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center gap-6"
      aria-live="polite"
      aria-label="Procesando solicitud"
    >
      <div className="w-full space-y-4">
        <p key={idx} className="font-body text-sm text-white/55 animate-wizard-step text-center">
          {MICROCOPY[idx]}
        </p>

        {/* Progressive bar */}
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #e07d00, #FF8C00)',
              boxShadow: '0 0 8px rgba(255,140,0,0.35)',
            }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del análisis"
          />
        </div>
      </div>
    </div>
  );
}
