'use client';

// Step 2 V2 — Contexto del negocio + problemas primarios multiselect
// Dark premium design system

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  step2SchemaV2,
  primaryProblemValues,
  type Step2DataV2,
} from '@/lib/intake/schema';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const PRIMARY_PROBLEM_LABELS: Record<typeof primaryProblemValues[number], string> = {
  professional_presence: 'Quiero verme más profesional',
  more_contacts: 'Quiero conseguir más clientes',
  organize_services: 'Quiero ordenar mis servicios',
  reduce_manual_work: 'Quiero reducir trabajo manual',
  replace_existing_site: 'Quiero mejorar mi sitio actual',
  launch_new_business: 'Quiero lanzar un nuevo proyecto',
  other: 'Otro',
};

interface Step2ContextProps {
  defaultValues: Partial<Step2DataV2>;
  firstName?: string;
  onNext: (data: Step2DataV2) => void;
  onBack: () => void;
}

export function Step2Context({ defaultValues, firstName, onNext, onBack }: Step2ContextProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Step2DataV2>({
    resolver: zodResolver(step2SchemaV2),
    defaultValues: {
      hasExistingSite: false,
      primaryProblems: [],
      ...defaultValues,
    },
  });

  const hasExistingSite = useWatch({ control, name: 'hasExistingSite' });
  const primaryProblems = useWatch({ control, name: 'primaryProblems' }) ?? [];
  const showOtherInput = primaryProblems.includes('other');

  function toggleProblem(value: typeof primaryProblemValues[number]) {
    const current = primaryProblems as string[];
    if (current.includes(value)) {
      setValue(
        'primaryProblems',
        current.filter((v) => v !== value) as typeof primaryProblems,
        { shouldValidate: true }
      );
    } else {
      setValue(
        'primaryProblems',
        [...current, value] as typeof primaryProblems,
        { shouldValidate: true }
      );
    }
  }

  const heading = firstName
    ? `Hola, ${firstName}. Cuéntanos sobre tu negocio.`
    : 'Cuéntanos sobre tu negocio.';

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="mb-8 space-y-2">
        <h2 className="font-headline text-xl font-semibold text-white">{heading}</h2>
      </div>

      <div className="space-y-6">
        {/* ¿Qué vendes u ofreces? */}
        <div>
          <label htmlFor="whatYouOffer" className={labelClass}>
            ¿Qué vendes u ofreces?
          </label>
          <textarea
            id="whatYouOffer"
            rows={3}
            maxLength={500}
            className={textareaClass(!!errors.whatYouOffer)}
            placeholder="Ej: Soy diseñadora gráfica freelance. Ofrezco branding, identidad visual y materiales para redes sociales."
            {...register('whatYouOffer')}
          />
          {errors.whatYouOffer && <FieldError message={errors.whatYouOffer.message} />}
        </div>

        {/* ¿Ya tienes sitio web? */}
        <div>
          <p className={labelClass}>¿Ya tienes sitio web?</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setValue('hasExistingSite', true, { shouldValidate: true })}
              className={chipClass(hasExistingSite === true)}
            >
              Si
            </button>
            <button
              type="button"
              onClick={() => {
                setValue('hasExistingSite', false, { shouldValidate: true });
                setValue('currentUrl', '');
              }}
              className={chipClass(hasExistingSite === false)}
            >
              No
            </button>
          </div>

          {hasExistingSite && (
            <div className="mt-3">
              <label htmlFor="currentUrl" className={labelClass}>
                URL de tu sitio actual
              </label>
              <input
                id="currentUrl"
                type="url"
                className={inputClass(!!errors.currentUrl)}
                placeholder="https://tuempresa.com"
                {...register('currentUrl')}
              />
              {errors.currentUrl && <FieldError message={errors.currentUrl.message} />}
            </div>
          )}
        </div>

        {/* Principal reto — multiselect */}
        <div>
          <p className={labelClass}>¿Cuál es tu principal reto ahora mismo?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {primaryProblemValues.map((value) => {
              const selected = (primaryProblems as string[]).includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleProblem(value)}
                  className={chipClass(selected)}
                >
                  {PRIMARY_PROBLEM_LABELS[value]}
                </button>
              );
            })}
          </div>
          {errors.primaryProblems && (
            <FieldError message={errors.primaryProblems.message as string} />
          )}

          {showOtherInput && (
            <div className="mt-3">
              <label htmlFor="primaryProblemsOther" className={labelClass}>
                Cuéntanos más
              </label>
              <input
                id="primaryProblemsOther"
                type="text"
                maxLength={200}
                className={inputClass(false)}
                placeholder="Describe tu reto..."
                {...register('primaryProblemsOther')}
              />
            </div>
          )}
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

const labelClass =
  'block font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/45 mb-2';

function chipClass(selected: boolean) {
  return selected
    ? 'rounded-lg bg-[#FF8C00] border border-transparent px-3.5 py-2.5 font-body text-sm font-medium text-[#121212] cursor-pointer transition-colors'
    : 'rounded-lg bg-white/[0.04] border border-white/[0.10] px-3.5 py-2.5 font-body text-sm text-white/65 cursor-pointer transition-all duration-150 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80';
}

function inputClass(hasError: boolean) {
  return [
    'w-full rounded-xl border px-4 py-3 font-body text-sm text-white',
    'bg-white/[0.04] placeholder:text-white/30',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2',
    hasError
      ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/10'
      : 'border-white/[0.10] hover:border-white/20 focus:border-[#FF8C00]/55 focus:ring-[#FF8C00]/10',
  ].join(' ');
}

function textareaClass(hasError: boolean) {
  return [
    'w-full rounded-xl border px-4 py-3 font-body text-sm leading-relaxed text-white resize-none',
    'bg-white/[0.04] placeholder:text-white/30',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2',
    hasError
      ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/10'
      : 'border-white/[0.10] hover:border-white/20 focus:border-[#FF8C00]/55 focus:ring-[#FF8C00]/10',
  ].join(' ');
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 font-body text-[11px] text-red-400">
      {message}
    </p>
  );
}
