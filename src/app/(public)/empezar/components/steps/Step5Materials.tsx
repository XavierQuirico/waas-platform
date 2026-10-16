'use client';

// Step 5 V2 — Materiales y preparación
// Dark premium design system

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  step5SchemaV2,
  brandIdentityStatusValues,
  copyStatusValues,
  photosStatusValues,
  domainStatusValues,
  currentAccessStatusValues,
  type Step5DataV2,
} from '@/lib/intake/schema';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Step5MaterialsProps {
  defaultValues: Partial<Step5DataV2>;
  hasExistingSite: boolean;
  onNext: (data: Step5DataV2) => void;
  onBack: () => void;
}

const BRAND_IDENTITY_LABELS: Record<typeof brandIdentityStatusValues[number], string> = {
  has_logo_and_style: 'Si, tengo logo y estilo definido',
  has_logo_no_style: 'Tengo logo, pero falta pulir el estilo',
  no_identity: 'No tengo identidad visual todavía',
};

const COPY_LABELS: Record<typeof copyStatusValues[number], string> = {
  ready: 'Si, ya tengo los textos',
  ideas_only: 'Tengo ideas, pero necesito ayuda redactando',
  needs_help: 'No tengo textos todavía',
};

const PHOTOS_LABELS: Record<typeof photosStatusValues[number], string> = {
  ready: 'Si, tengo material propio',
  needs_stock: 'Tengo algo, pero puede necesitar refuerzo',
  needs_help: 'No tengo material visual',
};

const DOMAIN_LABELS: Record<typeof domainStatusValues[number], string> = {
  has_domain: 'Si',
  no_domain: 'No',
  not_sure: 'No estoy seguro',
};

const CURRENT_ACCESS_LABELS: Record<typeof currentAccessStatusValues[number], string> = {
  has_access: 'Si',
  no_access: 'No',
  not_sure: 'No estoy seguro',
};

export function Step5Materials({ defaultValues, hasExistingSite, onNext, onBack }: Step5MaterialsProps) {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Step5DataV2>({
    resolver: zodResolver(step5SchemaV2),
    defaultValues,
  });

  const brandIdentityStatus = watch('brandIdentityStatus');
  const copyStatus = watch('copyStatus');
  const photosStatus = watch('photosStatus');
  const domainStatus = watch('domainStatus');
  const currentAccessStatus = watch('currentAccessStatus');

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="mb-8 space-y-2">
        <h2 className="font-headline text-xl font-semibold text-white">
          Antes de continuar, necesitamos saber con qué cuentas.
        </h2>
      </div>

      <div className="space-y-8">
        {/* Identidad visual */}
        <QuestionGroup
          label="¿Tienes identidad visual lista?"
          error={errors.brandIdentityStatus?.message}
        >
          {brandIdentityStatusValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('brandIdentityStatus', value, { shouldValidate: true })}
              className={chipClass(brandIdentityStatus === value)}
            >
              {BRAND_IDENTITY_LABELS[value]}
            </button>
          ))}
        </QuestionGroup>

        {/* Textos */}
        <QuestionGroup
          label="¿Tienes textos para el sitio?"
          error={errors.copyStatus?.message}
        >
          {copyStatusValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('copyStatus', value, { shouldValidate: true })}
              className={chipClass(copyStatus === value)}
            >
              {COPY_LABELS[value]}
            </button>
          ))}
        </QuestionGroup>

        {/* Fotos o videos */}
        <QuestionGroup
          label="¿Tienes fotos o videos propios?"
          error={errors.photosStatus?.message}
        >
          {photosStatusValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('photosStatus', value, { shouldValidate: true })}
              className={chipClass(photosStatus === value)}
            >
              {PHOTOS_LABELS[value]}
            </button>
          ))}
        </QuestionGroup>

        {/* Dominio */}
        <QuestionGroup
          label="¿Tienes dominio?"
          error={errors.domainStatus?.message}
        >
          {domainStatusValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('domainStatus', value, { shouldValidate: true })}
              className={chipClass(domainStatus === value)}
            >
              {DOMAIN_LABELS[value]}
            </button>
          ))}
        </QuestionGroup>

        {/* Acceso al sitio actual — condicional */}
        {hasExistingSite && (
          <QuestionGroup
            label="¿Tienes acceso a tu dominio o sitio actual?"
            error={errors.currentAccessStatus?.message}
          >
            {currentAccessStatusValues.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('currentAccessStatus', value, { shouldValidate: true })}
                className={chipClass(currentAccessStatus === value)}
              >
                {CURRENT_ACCESS_LABELS[value]}
              </button>
            ))}
          </QuestionGroup>
        )}
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

function QuestionGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/50 mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function chipClass(selected: boolean) {
  return selected
    ? 'rounded-lg bg-[#FF8C00] border border-transparent px-3 py-2 font-body text-sm font-medium text-[#121212] cursor-pointer transition-colors'
    : 'rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-body text-sm text-white/60 cursor-pointer transition-all duration-150 hover:border-white/20 hover:bg-white/[0.07]';
}
