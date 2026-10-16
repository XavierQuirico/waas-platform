'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, X } from 'lucide-react';
import type { GroqIntakeInterpretation } from '@/lib/intake/types';
import type { Step1DataV2, Step2DataV2, Step3DataV2, Step4DataV2, Step5DataV2 } from '@/lib/intake/schema';

export type WizardDataV2 = Partial<
  Step1DataV2 & Step2DataV2 & Step3DataV2 & Step4DataV2 & Step5DataV2
>;

const PRIMARY_PROBLEM_LABELS: Record<string, string> = {
  professional_presence: 'Verme más profesional',
  more_contacts: 'Conseguir más clientes',
  organize_services: 'Ordenar mis servicios',
  reduce_manual_work: 'Reducir trabajo manual',
  replace_existing_site: 'Mejorar mi sitio actual',
  launch_new_business: 'Lanzar un nuevo proyecto',
  other: 'Otro',
};

const PRIMARY_GOAL_LABELS: Record<string, string> = {
  contacts: 'Conseguir contactos',
  services_brand: 'Mostrar servicios o marca',
  booking: 'Recibir reservas o citas',
  catalog: 'Mostrar catálogo de productos',
  orders_sales: 'Recibir pedidos o ventas',
  online_payments: 'Aceptar pagos online',
  content_news: 'Publicar contenido o noticias',
  full_ownership: 'Propiedad completa del sitio',
};

const PLAN_DISPLAY: Record<string, string> = {
  BASIC: 'Basic',
  PRO: 'Pro',
  BUSINESS: 'Business',
  LEGACY: 'Legacy / Personalizado',
};

const MATERIAL_LABEL = {
  brandIdentity: {
    has_logo_and_style: 'Lista',
    has_logo_no_style: 'Parcial',
    no_identity: 'Sin identidad',
  },
  copy: {
    ready: 'Listos',
    ideas_only: 'En proceso',
    needs_help: 'Sin textos',
  },
  photos: {
    ready: 'Listos',
    needs_stock: 'Parcial',
    needs_help: 'Sin material',
  },
} as const;

interface PlanRecommendation {
  label: string | null;
  text: string;
  isCustom: boolean;
}

function getPlanRecommendation(
  groq: GroqIntakeInterpretation | null,
  intent: string | null,
  goals: string[],
): PlanRecommendation {
  const hasFullOwnership = goals.includes('full_ownership');
  if (groq?.planSignals?.suggestsLegacy || hasFullOwnership) {
    return {
      label: 'Legacy / Personalizado',
      text: 'Tu proyecto parece requerir una revisión personalizada. Xavier evaluará el alcance antes de enviarte una propuesta.',
      isCustom: true,
    };
  }
  if (groq?.planSignals?.suggestsBusiness) {
    return {
      label: 'Business',
      text: 'Según lo que describes, parece encajar mejor con el plan Business. Xavier lo confirmará antes de enviarte la propuesta.',
      isCustom: false,
    };
  }
  if (groq?.planSignals?.suggestsPro) {
    return {
      label: 'Pro',
      text: 'Según lo que describes, parece encajar mejor con el plan Pro. Xavier lo revisará y te enviará la propuesta.',
      isCustom: false,
    };
  }
  if (intent && PLAN_DISPLAY[intent]) {
    return {
      label: PLAN_DISPLAY[intent],
      text: `Tienes seleccionado el plan ${PLAN_DISPLAY[intent]}. Xavier validará si es el más adecuado antes de enviarte la propuesta.`,
      isCustom: false,
    };
  }
  return {
    label: null,
    text: 'Xavier revisará tu solicitud y te enviará una propuesta personalizada según lo que necesitas.',
    isCustom: false,
  };
}

function getMissingStep(data: WizardDataV2): string | null {
  if (!data.firstName || !data.lastName || !data.email || !data.businessName || !data.whatsapp || !data.industry) {
    return 'Paso 1 — Contacto';
  }
  if (!data.whatYouOffer || !data.primaryProblems || data.primaryProblems.length === 0) {
    return 'Paso 2 — Negocio';
  }
  if (!data.primaryGoals || data.primaryGoals.length === 0) {
    return 'Paso 3 — Objetivos';
  }
  if (!data.freeformBrief || data.freeformBrief.length < 20) {
    return 'Paso 4 — Brief';
  }
  if (!data.brandIdentityStatus || !data.copyStatus || !data.photosStatus || !data.domainStatus) {
    return 'Paso 5 — Materiales';
  }
  return null;
}

interface Step6SummaryProps {
  formData: WizardDataV2;
  selectedPlanIntent: string | null;
  groqInterpretation: GroqIntakeInterpretation | null;
  isSubmitting: boolean;
  submitError?: string | null;
  emailConflict?: boolean;
  termsAccepted: boolean;
  onTermsAccepted: (v: boolean) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function Step6Summary({
  formData,
  selectedPlanIntent,
  groqInterpretation,
  isSubmitting,
  submitError,
  emailConflict = false,
  termsAccepted,
  onTermsAccepted,
  onSubmit,
  onBack,
}: Step6SummaryProps) {
  const { isSignedIn } = useUser();

  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const missingStep = getMissingStep(formData);
  const rec = getPlanRecommendation(
    groqInterpretation,
    selectedPlanIntent,
    formData.primaryGoals ?? [],
  );

  const ctaLabel = isSignedIn ? 'Ir al estado de mi solicitud' : 'Crear acceso al portal';

  const nextSteps = [
    isSignedIn
      ? 'Accedes a tu portal para ver el estado de tu solicitud.'
      : 'Creas tu acceso al portal en segundos.',
    'Xavier revisa tu solicitud y te escribe por WhatsApp.',
    'Recibes propuesta si hay fit.',
  ];

  // Trap focus inside modal
  useEffect(() => {
    if (!termsModalOpen) return;
    const el = closeButtonRef.current;
    el?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !termsAccepted) {
        setTermsModalOpen(false);
      }
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [termsModalOpen, termsAccepted]);

  const handleScrollContent = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) setHasScrolledToEnd(true);
  }, []);

  function handleCheckboxClick() {
    if (termsAccepted) {
      onTermsAccepted(false);
      return;
    }
    setHasScrolledToEnd(false);
    setTermsModalOpen(true);
  }

  function handleModalAccept() {
    onTermsAccepted(true);
    setTermsModalOpen(false);
    setTermsError(false);
  }

  function handleSubmitClick() {
    if (!termsAccepted) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    onSubmit();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF8C00]/10">
          <CheckCircle2 className="h-4 w-4 text-[#FF8C00]/80" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-headline text-xl font-semibold text-white leading-snug">
            Tu solicitud está lista
          </h2>
          <p className="mt-0.5 font-body text-sm text-white/55">
            Revisa un momento antes de enviar.
          </p>
        </div>
      </div>

      {/* Missing data warning */}
      {missingStep && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="font-body text-sm text-amber-300/80 leading-relaxed">
            Falta completar el <span className="font-medium">{missingStep}</span>. Haz click en{' '}
            <span className="font-medium">Atrás</span> para completarlo antes de enviar.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {/* Contact */}
        {(formData.firstName || formData.businessName) && (
          <SummaryCard label="Contacto">
            <p className="font-body text-sm text-white/70">
              {[formData.firstName, formData.lastName].filter(Boolean).join(' ')}
            </p>
            {formData.businessName && (
              <p className="font-body text-xs text-white/50 mt-0.5">{formData.businessName}</p>
            )}
          </SummaryCard>
        )}

        {/* Retos */}
        {(formData.primaryProblems ?? []).length > 0 && (
          <SummaryCard label="Retos principales">
            <div className="flex flex-wrap gap-1.5">
              {(formData.primaryProblems ?? []).map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center rounded-full border border-[#FF8C00]/20 bg-[#FF8C00]/[0.06] px-2.5 py-1 font-body text-xs font-medium text-[#FF8C00]/75"
                >
                  {PRIMARY_PROBLEM_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          </SummaryCard>
        )}

        {/* Objetivos */}
        {(formData.primaryGoals ?? []).length > 0 && (
          <SummaryCard label="Objetivos del sitio">
            <div className="flex flex-wrap gap-1.5">
              {(formData.primaryGoals ?? []).map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center rounded-full border border-[#6B9FFF]/20 bg-[#6B9FFF]/[0.06] px-2.5 py-1 font-body text-xs font-medium text-[#6B9FFF]/75"
                >
                  {PRIMARY_GOAL_LABELS[g] ?? g}
                </span>
              ))}
            </div>
          </SummaryCard>
        )}

        {/* Materiales */}
        {(formData.brandIdentityStatus || formData.copyStatus || formData.photosStatus) && (
          <SummaryCard label="Materiales">
            <div className="grid grid-cols-3 gap-2">
              {formData.brandIdentityStatus && (
                <MaterialBadge
                  name="Identidad"
                  value={MATERIAL_LABEL.brandIdentity[formData.brandIdentityStatus as keyof typeof MATERIAL_LABEL.brandIdentity] ?? '—'}
                />
              )}
              {formData.copyStatus && (
                <MaterialBadge
                  name="Textos"
                  value={MATERIAL_LABEL.copy[formData.copyStatus as keyof typeof MATERIAL_LABEL.copy] ?? '—'}
                />
              )}
              {formData.photosStatus && (
                <MaterialBadge
                  name="Fotos"
                  value={MATERIAL_LABEL.photos[formData.photosStatus as keyof typeof MATERIAL_LABEL.photos] ?? '—'}
                />
              )}
            </div>
          </SummaryCard>
        )}

        {/* Groq AI analysis */}
        {groqInterpretation?.humanSummary && (
          <div
            className="rounded-xl border border-[#FF8C00]/20 p-5"
            style={{
              background: 'linear-gradient(140deg, rgba(255,140,0,0.12) 0%, rgba(255,140,0,0.03) 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF8C00]/15">
                <Bot className="h-3 w-3 text-[#FF8C00]/80" aria-hidden="true" />
              </div>
              <p className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-[#FF8C00]/60">
                Análisis preliminar
              </p>
            </div>
            <p className="font-body text-sm text-white/65 leading-relaxed">
              {groqInterpretation.humanSummary}
            </p>
          </div>
        )}

        {/* Plan recommendation */}
        <div
          className="rounded-xl border border-[#6B9FFF]/20 p-5 space-y-2.5"
          style={{
            background: 'linear-gradient(140deg, rgba(0,71,171,0.12) 0%, rgba(0,71,171,0.03) 100%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <span className="inline-flex items-center rounded-full border border-[#6B9FFF]/25 bg-[#6B9FFF]/[0.08] px-2.5 py-0.5 font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-[#6B9FFF]/80">
            {rec.label
              ? (rec.isCustom ? 'Revisión personalizada' : `Plan sugerido: ${rec.label}`)
              : 'Propuesta personalizada'}
          </span>
          <p className="font-body text-sm text-white/60 leading-relaxed">{rec.text}</p>
          <p className="font-body text-xs text-white/35">
            Xavier valida antes de cualquier propuesta o cobro.
          </p>
        </div>

        {/* Next steps */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="mb-3 font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/30">
            ¿Qué pasa después?
          </p>
          <ol className="space-y-2">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.10] font-label font-semibold text-[9px] text-white/30">
                  {i + 1}
                </span>
                <span className="font-body text-xs leading-relaxed text-white/50">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Email conflict card */}
      {emailConflict && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 space-y-2">
          <p className="font-headline text-sm font-semibold text-white/85">
            Ya tienes una cuenta con ese email
          </p>
          <p className="font-body text-sm text-white/55 leading-relaxed">
            Inicia sesión para continuar y ver el estado de tu solicitud.
          </p>
          <a
            href="/acceder?redirect_url=/dashboard"
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 font-body text-sm text-white/70 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
          >
            Acceder a mi cuenta
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Generic error */}
      {submitError && !emailConflict && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5"
        >
          <p className="font-body text-sm text-red-400/90">{submitError}</p>
        </div>
      )}

      {/* Terms acceptance */}
      {!emailConflict && (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={termsAccepted}
            onClick={handleCheckboxClick}
            className="flex w-full items-start gap-3 text-left"
          >
            <span
              className={[
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150',
                termsAccepted
                  ? 'border-[#FF8C00]/60 bg-[#FF8C00]/15'
                  : 'border-white/20 bg-white/[0.03]',
              ].join(' ')}
              aria-hidden="true"
            >
              {termsAccepted && (
                <svg className="h-2.5 w-2.5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            <span className="font-body text-xs leading-relaxed text-white/50">
              He leído y acepto los{' '}
              <span className="text-white/70 underline underline-offset-2">
                términos y condiciones del servicio
              </span>
              . Entiendo que enviar esta solicitud no implica pago ni contratación inmediata.
            </span>
          </button>

          {termsError && !termsAccepted && (
            <p role="alert" className="font-body text-xs text-amber-400/80">
              Debes aceptar los términos para continuar. Haz click en el checkbox para leerlos.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-5 py-3 font-body text-sm font-medium text-white/60 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        {!emailConflict && (
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isSubmitting || !!missingStep}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF8C00] px-6 py-3.5 text-sm font-semibold font-headline text-[#121212] transition-all duration-150 hover:bg-[#e07d00] hover:shadow-[0_4px_16px_rgba(255,140,0,0.2)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#121212]/20 border-t-[#121212]/70"
                  aria-hidden="true"
                />
                Enviando...
              </>
            ) : ctaLabel}
          </button>
        )}
      </div>

      {/* Terms modal */}
      {termsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="terms-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !termsAccepted && setTermsModalOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.10] bg-[#0C0D10] shadow-2xl shadow-black/60 flex flex-col"
            style={{ maxHeight: 'min(80vh, 600px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h2
                id="terms-modal-title"
                className="font-headline text-sm font-semibold text-white"
              >
                Términos y condiciones del servicio
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setTermsModalOpen(false)}
                aria-label="Cerrar términos"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/40 transition-colors hover:border-white/15 hover:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              onScroll={handleScrollContent}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
              tabIndex={0}
            >
              <TermsSection title="Qué significa enviar esta solicitud">
                <TermsBullet>
                  Al enviar este formulario, estás enviando una solicitud de información a Quirico Studios.
                  <strong className="text-white/75"> No implica pago inmediato ni contratación.</strong>
                </TermsBullet>
                <TermsBullet>
                  Xavier revisará tu solicitud y se pondrá en contacto contigo por WhatsApp o email para
                  conocer más sobre tu proyecto.
                </TermsBullet>
                <TermsBullet>
                  Si hay fit entre tu proyecto y el servicio, recibirás una propuesta personalizada.
                  Cualquier pago o contratación se confirma después, con una propuesta validada que
                  deberás aceptar explícitamente.
                </TermsBullet>
              </TermsSection>

              <TermsSection title="Tus datos">
                <TermsBullet>
                  Los datos que envías (nombre, email, WhatsApp, información de tu negocio) se utilizan
                  exclusivamente para preparar tu propuesta y contactarte.
                </TermsBullet>
                <TermsBullet>
                  Tu información no se comparte con terceros ni se usa para fines publicitarios.
                </TermsBullet>
                <TermsBullet>
                  Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a
                  xavier@quiricostudios.com.
                </TermsBullet>
              </TermsSection>

              <TermsSection title="Sobre el servicio de QUIRICO STUDIOS">
                <TermsBullet>
                  QUIRICO STUDIOS ofrece diseño, desarrollo y alojamiento de sitios web profesionales
                  bajo una suscripción mensual. Cada sitio se crea a medida para tu negocio.
                </TermsBullet>
                <TermsBullet>
                  Los detalles exactos, precios y condiciones del servicio se especifican en la propuesta
                  personalizada que recibirás si hay fit.
                </TermsBullet>
                <TermsBullet>
                  No tienes acceso a editor ni panel de administración. El sitio es gestionado por el
                  equipo de QUIRICO STUDIOS. Los cambios posteriores al período de revisión gratuita
                  se gestionan como tickets de soporte.
                </TermsBullet>
              </TermsSection>

              <TermsSection title="Compromisos al contratar (aplicables solo si aceptas la propuesta)">
                <TermsBullet>
                  El servicio requiere un compromiso mínimo de 6 meses desde el lanzamiento de tu sitio.
                </TermsBullet>
                <TermsBullet>
                  Cancelar antes de completar los 6 meses implica un cargo del 50% del valor de los
                  meses restantes.
                </TermsBullet>
                <TermsBullet>
                  El pago mensual se procesa automáticamente. Un pago fallido suspende el sitio
                  temporalmente, sin pérdida de datos.
                </TermsBullet>
              </TermsSection>

              <p className="font-body text-[11px] text-white/30 leading-relaxed pt-2">
                Versión 1.0 — QUIRICO STUDIOS. Para dudas, escribe a xavier@quiricostudios.com.
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-5 py-4">
              {!hasScrolledToEnd && (
                <p className="mb-3 font-body text-[11px] text-white/35 text-center">
                  Desplázate hacia abajo para habilitar el botón de aceptación.
                </p>
              )}
              <button
                type="button"
                onClick={handleModalAccept}
                disabled={!hasScrolledToEnd}
                className="w-full rounded-xl bg-[#FF8C00] py-3 text-sm font-semibold font-headline text-[#121212] transition-all duration-150 hover:bg-[#e07d00] disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/40"
              >
                Acepto los términos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
      <p className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/40">
        {label}
      </p>
      {children}
    </div>
  );
}

function MaterialBadge({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center">
      <p className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/40">{name}</p>
      <p className="font-body text-xs text-white/55 mt-0.5">{value}</p>
    </div>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-label font-semibold text-[10px] uppercase tracking-[0.10em] text-white/40">
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function TermsBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF8C00]/40" aria-hidden="true" />
      <span className="font-body text-xs text-white/55 leading-relaxed">{children}</span>
    </li>
  );
}
