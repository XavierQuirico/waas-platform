'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step4SchemaV2, type Step4DataV2 } from '@/lib/intake/schema';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';

interface Step4ProposalProps {
  defaultValues: { freeformBrief?: string };
  onNext: (data: Step4DataV2) => void;
  onBack: () => void;
}

const BRIEF_HINTS = ['Tipo de negocio', 'Lo que quieres lograr', 'Materiales disponibles'];

export function Step4Proposal({ defaultValues, onNext, onBack }: Step4ProposalProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Step4DataV2>({
    resolver: zodResolver(step4SchemaV2),
    defaultValues: {
      freeformBrief: defaultValues.freeformBrief ?? '',
    },
  });

  const brief = useWatch({ control, name: 'freeformBrief' }) ?? '';
  const charCount = brief.length;

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="mb-7 space-y-1.5">
        <h2 className="font-headline text-xl font-semibold text-white leading-snug">
          Cuéntanos qué tienes en mente
        </h2>
        <p className="font-body text-sm text-white/60">
          Con tus palabras. No hay respuestas incorrectas.
        </p>
      </div>

      <div className="space-y-4">
        {/* Example card */}
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FF8C00]/15">
              <FileText className="h-2.5 w-2.5 text-[#FF8C00]/70" aria-hidden="true" />
            </div>
            <span className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-[#FF8C00]/55">
              Ejemplo de buen brief
            </span>
          </div>
          <div className="space-y-3 p-4">
            <p className="font-body text-xs italic leading-relaxed text-white/50">
              &ldquo;Tengo una clínica estética. Quiero mostrar servicios, recibir citas por
              WhatsApp y que el sitio se vea elegante. Tengo logo y fotos, pero necesito ayuda con
              los textos.&rdquo;
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BRIEF_HINTS.map((hint) => (
                <span
                  key={hint}
                  className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-body text-[10px] text-white/38"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div>
          <textarea
            id="freeformBrief"
            rows={7}
            maxLength={2000}
            className={[
              'w-full rounded-xl border px-4 py-3.5 font-body text-sm leading-relaxed text-white',
              'bg-white/[0.04] placeholder:text-white/30 resize-none',
              'transition-all duration-200 focus:outline-none focus:ring-2',
              errors.freeformBrief
                ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/10'
                : 'border-white/[0.10] hover:border-white/20 focus:border-[#FF8C00]/55 focus:ring-[#FF8C00]/10',
            ].join(' ')}
            placeholder="Describe tu negocio y lo que buscas..."
            {...register('freeformBrief')}
          />
          <div className="mt-2 flex items-center justify-between">
            {errors.freeformBrief ? (
              <p role="alert" className="flex items-center gap-1.5 font-body text-[11px] text-red-400">
                <span aria-hidden="true" className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {errors.freeformBrief.message}
              </p>
            ) : (
              <span />
            )}
            <span
              className={[
                'font-label text-[10px] tabular-nums transition-colors',
                charCount > 1800 ? 'text-amber-400/70' : 'text-white/25',
              ].join(' ')}
            >
              {charCount}/2000
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-5 py-3 font-body text-sm font-medium text-white/60 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <button
          type="submit"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF8C00] px-6 py-3.5 text-sm font-semibold font-headline text-[#121212] transition-all duration-150 hover:bg-[#e07d00] hover:shadow-[0_4px_16px_rgba(255,140,0,0.2)] active:scale-[0.98]"
        >
          Continuar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
