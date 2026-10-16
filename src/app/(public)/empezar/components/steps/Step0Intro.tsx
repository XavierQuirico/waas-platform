'use client';

interface Step0IntroProps {
  onNext: () => void;
}

export function Step0Intro({ onNext }: Step0IntroProps) {
  return (
    <div className="space-y-8">
      {/* Isotipo de marca como acento visual dentro de la tarjeta */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo/ISOTIPO.svg"
          alt=""
          aria-hidden="true"
          className="h-7 w-7 opacity-70"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <span className="font-label text-[10px] uppercase tracking-[0.20em] text-white/50">
          Propuesta personalizada
        </span>
      </div>

      <div className="space-y-4">
        <h1 className="font-headline text-2xl font-semibold text-white leading-snug">
          Vamos a entender tu negocio para confirmar el mejor camino.
        </h1>
        <p className="font-body text-sm text-white/65 leading-relaxed">
          Responde algunas preguntas y Xavier revisará tu caso en 24–48h.
          Sin compromisos todavía.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-xl bg-[#FF8C00] px-6 py-3.5 text-sm font-semibold font-headline text-[#121212] transition-all duration-150 hover:bg-[#e07d00] active:scale-[0.98]"
      >
        Empezar
      </button>
    </div>
  );
}
