'use client';

// Step 3 V2 — Objetivos principales multiselect
// Dark premium design system

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step3SchemaV2, primaryGoalValues, type Step3DataV2 } from '@/lib/intake/schema';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const PRIMARY_GOAL_LABELS: Record<typeof primaryGoalValues[number], string> = {
  contacts: 'Conseguir contactos',
  services_brand: 'Mostrar servicios o marca',
  booking: 'Recibir reservas o citas',
  catalog: 'Mostrar catálogo de productos',
  orders_sales: 'Recibir pedidos o ventas',
  online_payments: 'Aceptar pagos online',
  content_news: 'Publicar contenido o noticias',
  full_ownership: 'Tener propiedad completa del sitio',
};

interface Step3FeaturesProps {
  defaultValues: Partial<Step3DataV2>;
  onNext: (data: Step3DataV2) => void;
  onBack: () => void;
}

export function Step3Features({ defaultValues, onNext, onBack }: Step3FeaturesProps) {
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Step3DataV2>({
    resolver: zodResolver(step3SchemaV2),
    defaultValues: {
      primaryGoals: [],
      ...defaultValues,
    },
  });

  const primaryGoals = useWatch({ control, name: 'primaryGoals' }) ?? [];
  const showMicrocopy = primaryGoals.length >= 3;

  function toggleGoal(value: typeof primaryGoalValues[number]) {
    const current = primaryGoals as string[];
    if (current.includes(value)) {
      setValue(
        'primaryGoals',
        current.filter((v) => v !== value) as typeof primaryGoals,
        { shouldValidate: true }
      );
    } else {
      setValue(
        'primaryGoals',
        [...current, value] as typeof primaryGoals,
        { shouldValidate: true }
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="mb-8 space-y-2">
        <h2 className="font-headline text-xl font-semibold text-white">
          ¿Qué quieres que logre principalmente tu sitio?
        </h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {primaryGoalValues.map((value) => {
          const selected = (primaryGoals as string[]).includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleGoal(value)}
              className={chipClass(selected)}
            >
              {PRIMARY_GOAL_LABELS[value]}
            </button>
          );
        })}
      </div>

      {errors.primaryGoals && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {errors.primaryGoals.message as string}
        </p>
      )}

      {showMicrocopy && (
        <p className="mt-3 font-body text-xs text-white/55">
          Elige las más importantes. Xavier puede ayudarte a ordenar el alcance después.
        </p>
      )}

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

function chipClass(selected: boolean) {
  return selected
    ? 'rounded-lg bg-[#FF8C00] border border-transparent px-3 py-2 font-body text-sm font-medium text-[#121212] cursor-pointer transition-colors'
    : 'rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-body text-sm text-white/60 cursor-pointer transition-all duration-150 hover:border-white/20 hover:bg-white/[0.07]';
}
