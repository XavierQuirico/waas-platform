'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { step1SchemaV2, nicheValues, type Step1DataV2 } from '@/lib/intake/schema';
import { ArrowLeft, ArrowRight, ChevronDown, Check } from 'lucide-react';
import { WizardListbox } from '../WizardListbox';

// ─── Country codes ─────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+1',   abbr: 'RD', label: 'República Dominicana' },
  { code: '+1',   abbr: 'US', label: 'EE.UU. / Canadá' },
  { code: '+52',  abbr: 'MX', label: 'México' },
  { code: '+34',  abbr: 'ES', label: 'España' },
  { code: '+57',  abbr: 'CO', label: 'Colombia' },
  { code: '+58',  abbr: 'VE', label: 'Venezuela' },
  { code: '+56',  abbr: 'CL', label: 'Chile' },
  { code: '+54',  abbr: 'AR', label: 'Argentina' },
  { code: '+51',  abbr: 'PE', label: 'Perú' },
  { code: '+55',  abbr: 'BR', label: 'Brasil' },
  { code: '+593', abbr: 'EC', label: 'Ecuador' },
  { code: '+507', abbr: 'PA', label: 'Panamá' },
  { code: '+503', abbr: 'SV', label: 'El Salvador' },
  { code: '+502', abbr: 'GT', label: 'Guatemala' },
  { code: '+504', abbr: 'HN', label: 'Honduras' },
  { code: '+505', abbr: 'NI', label: 'Nicaragua' },
  { code: '+506', abbr: 'CR', label: 'Costa Rica' },
  { code: '+44',  abbr: 'GB', label: 'Reino Unido' },
  { code: '+33',  abbr: 'FR', label: 'Francia' },
  { code: '+49',  abbr: 'DE', label: 'Alemania' },
] as const;

const NICHE_LABELS: Record<typeof nicheValues[number], string> = {
  salud: 'Salud y bienestar',
  legal: 'Legal y consultoría',
  fitness: 'Fitness y deporte',
  gastronomia: 'Gastronomía y restaurantes',
  inmobiliaria: 'Inmobiliaria y propiedades',
  educacion: 'Educación y formación',
  marca_personal: 'Marca personal',
  otro: 'Otro',
};

const NICHE_ITEMS = nicheValues.map((niche) => ({
  value: niche,
  label: NICHE_LABELS[niche],
}));

function extractWhatsappParts(raw: string): { countryIndex: number; local: string } {
  if (!raw) return { countryIndex: 0, local: '' };
  if (!raw.startsWith('+')) return { countryIndex: 0, local: raw.replace(/\D/g, '') };

  const indexed = COUNTRY_CODES.map((c, i) => ({ code: c.code, i })).sort(
    (a, b) => b.code.length - a.code.length
  );
  for (const { code, i } of indexed) {
    if (raw.startsWith(code)) {
      return { countryIndex: i, local: raw.slice(code.length).replace(/\D/g, '') };
    }
  }
  return { countryIndex: 0, local: raw.replace(/\D/g, '') };
}

interface Step1ContactProps {
  defaultValues: Partial<Step1DataV2>;
  onNext: (data: Step1DataV2) => void;
  onBack: () => void;
}

export function Step1Contact({ defaultValues, onNext, onBack }: Step1ContactProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Step1DataV2>({
    resolver: zodResolver(step1SchemaV2),
    defaultValues,
  });

  const { field: whatsappField, fieldState: { error: whatsappError } } =
    useController({ name: 'whatsapp', control });
  const { field: industryField, fieldState: { error: industryError } } =
    useController({ name: 'industry', control });

  const initial = extractWhatsappParts(defaultValues.whatsapp ?? '');
  const [countryIndex, setCountryIndex] = useState(initial.countryIndex);
  const [localNumber, setLocalNumber] = useState(initial.local);
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  // Sync whatsapp field whenever country or number changes
  useEffect(() => {
    const digits = localNumber.replace(/\D/g, '');
    const code = COUNTRY_CODES[countryIndex].code;
    whatsappField.onChange(digits ? `${code}${digits}` : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryIndex, localNumber]);

  // Close country dropdown on outside click or Escape
  useEffect(() => {
    if (!countryOpen) return;
    function onOutside(e: MouseEvent) {
      if (!countryRef.current?.contains(e.target as Node)) setCountryOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCountryOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [countryOpen]);

  const currentCountry = COUNTRY_CODES[countryIndex];

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="mb-7 space-y-1.5">
        <h2 className="font-headline text-xl font-semibold text-white leading-snug">
          Datos de contacto
        </h2>
        <p className="font-body text-sm text-white/65">
          Cuéntanos un poco sobre ti para empezar.
        </p>
      </div>

      <div className="space-y-5">
        {/* Nombre y apellido */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>Nombre</label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              className={inputClass(!!errors.firstName)}
              placeholder="María"
              {...register('firstName')}
            />
            {errors.firstName && <FieldError message={errors.firstName.message} />}
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>Apellido</label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              className={inputClass(!!errors.lastName)}
              placeholder="González"
              {...register('lastName')}
            />
            {errors.lastName && <FieldError message={errors.lastName.message} />}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className={labelClass}>Email de contacto</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass(!!errors.email)}
            placeholder="maria@tunegocio.com"
            {...register('email')}
          />
          {errors.email && <FieldError message={errors.email.message} />}
        </div>

        {/* WhatsApp — single-row: compact country picker + number input */}
        <div>
          <label htmlFor="whatsapp-number" className={labelClass}>WhatsApp</label>

          {/*
            Outer container: border + ring only — NO overflow-hidden so the
            country dropdown (position:absolute) isn't clipped.
            Each child applies its own rounded corners.
          */}
          <div
            className={[
              'flex rounded-xl border transition-all duration-200 focus-within:ring-2',
              whatsappError
                ? 'border-red-500/40 focus-within:border-red-500/50 focus-within:ring-red-500/10'
                : 'border-white/[0.10] hover:border-white/20 focus-within:border-[#FF8C00]/55 focus-within:ring-[#FF8C00]/10',
            ].join(' ')}
          >
            {/* Country selector — compact trigger (~76px), wide dropdown */}
            <div ref={countryRef} className="relative shrink-0" style={{ width: '76px' }}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={countryOpen}
                aria-label={`Código de país: ${currentCountry.abbr} ${currentCountry.code}`}
                onClick={() => setCountryOpen((v) => !v)}
                className="flex h-full w-full items-center justify-between gap-1 rounded-l-xl border-r border-white/[0.10] bg-white/[0.04] px-2.5 py-3 transition-colors hover:bg-white/[0.07] focus:outline-none"
              >
                {/* abbr: label token (Inter Tight semibold uppercase) */}
                <span className="truncate font-label font-semibold text-[10px] tracking-[0.06em] text-white/55">
                  {currentCountry.abbr}
                </span>
                {/* dial code */}
                <span className="shrink-0 font-label text-[10px] text-white/35">
                  {currentCountry.code}
                </span>
                <ChevronDown
                  className={`h-3 w-3 shrink-0 text-white/20 transition-transform duration-200 ${countryOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {/* Country dropdown — min-width overrides trigger width, left-aligned */}
              {countryOpen && (
                <ul
                  role="listbox"
                  aria-label="Selecciona tu país"
                  className="absolute left-0 top-full z-50 mt-1.5 max-h-56 min-w-[228px] overflow-y-auto rounded-xl border border-white/[0.10] bg-[#0F1014] py-1 shadow-xl shadow-black/70 animate-wizard-step"
                >
                  {COUNTRY_CODES.map((c, i) => {
                    const isSel = i === countryIndex;
                    return (
                      <li
                        key={i}
                        role="option"
                        aria-selected={isSel}
                        onClick={() => { setCountryIndex(i); setCountryOpen(false); }}
                        className={[
                          'flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors',
                          isSel
                            ? 'bg-[#FF8C00]/10'
                            : 'hover:bg-white/[0.05]',
                        ].join(' ')}
                      >
                        {/* abbr: label token */}
                        <span className={`w-5 shrink-0 font-label font-semibold text-[10px] tracking-[0.06em] ${isSel ? 'text-[#FF8C00]/70' : 'text-white/30'}`}>
                          {c.abbr}
                        </span>
                        {/* country name: body token */}
                        <span className={`flex-1 font-body text-xs ${isSel ? 'text-[#FF8C00]/85' : 'text-white/65'}`}>
                          {c.label}
                        </span>
                        {/* dial code */}
                        <span className={`shrink-0 font-label text-[10px] ${isSel ? 'text-[#FF8C00]/50' : 'text-white/25'}`}>
                          {c.code}
                        </span>
                        {isSel && (
                          <Check className="h-3 w-3 shrink-0 text-[#FF8C00]/60" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Number input */}
            <input
              id="whatsapp-number"
              data-testid="whatsapp-number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s\-]/g, ''))}
              onBlur={whatsappField.onBlur}
              ref={whatsappField.ref}
              placeholder="809 000 0000"
              className="min-w-0 flex-1 rounded-r-xl border-0 bg-white/[0.04] px-4 py-3 font-body text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
            />
          </div>

          {whatsappError && <FieldError message={whatsappError.message} />}
        </div>

        {/* Nombre del negocio */}
        <div>
          <label htmlFor="businessName" className={labelClass}>Nombre del negocio</label>
          <input
            id="businessName"
            type="text"
            autoComplete="organization"
            className={inputClass(!!errors.businessName)}
            placeholder="Clínica Dental González"
            {...register('businessName')}
          />
          {errors.businessName && <FieldError message={errors.businessName.message} />}
        </div>

        {/* Industria — listbox premium */}
        <div>
          <label id="industry-label" className={labelClass}>Industria</label>
          <WizardListbox
            items={NICHE_ITEMS}
            value={industryField.value ?? ''}
            onChange={(v) => industryField.onChange(v)}
            placeholder="Selecciona una industria"
            hasError={!!industryError}
            aria-labelledby="industry-label"
          />
          {industryError && <FieldError message={industryError.message} />}
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
          disabled={isSubmitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF8C00] px-6 py-3.5 text-sm font-semibold font-headline text-[#121212] transition-all duration-150 hover:bg-[#e07d00] hover:shadow-[0_4px_16px_rgba(255,140,0,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────
const labelClass =
  'block font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/45 mb-2';

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 font-body text-[11px] text-red-400">
      <span aria-hidden="true" className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
      {message}
    </p>
  );
}
