'use client';

// IntakeWizard V2 — Wizard de intake público (7 pasos)
// Pasos: 0=Intro, 1=Contacto, 2=Contexto, 3=Objetivos,
//        4=Brief (Groq), 5=Materiales, 6=Resumen + submit

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { Step0Intro } from './steps/Step0Intro';
import { Step1Contact } from './steps/Step1Contact';
import { Step2Context } from './steps/Step2Context';
import { Step3Features } from './steps/Step3Features';
import { Step4Proposal } from './steps/Step4Proposal';
import { Step5Materials } from './steps/Step5Materials';
import { Step6Summary } from './steps/Step6Summary';
import { WizardProgress } from './WizardProgress';
import { WizardLoader } from './WizardLoader';
import { saveDraftV2, loadDraftV2, clearDraftV2 } from '@/lib/intake/auto-save';
import { interpretIntakeWithGroq } from '../actions';
import type { GroqIntakeInterpretation } from '@/lib/intake/types';
import type {
  Step1DataV2,
  Step2DataV2,
  Step3DataV2,
  Step4DataV2,
  Step5DataV2,
} from '@/lib/intake/schema';
import type { WizardDataV2 } from './steps/Step6Summary';

const TOTAL_STEPS = 6;

const VALID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'] as const;
type ValidPlan = typeof VALID_PLANS[number];

const PLAN_DISPLAY: Record<ValidPlan, string> = {
  BASIC: 'Basic',
  PRO: 'Pro',
  BUSINESS: 'Business',
  LEGACY: 'Legacy',
};

interface IntakeWizardProps {
  initialPlanIntent?: ValidPlan | null;
}

// Extracts a human-readable error string from an unknown tRPC/fetch error response.
// Never returns raw JSON objects or internal codes.
function extractHumanError(data: unknown): string {
  const fallback = 'No pudimos guardar tu solicitud. Inténtalo de nuevo.';
  const validationMsg = 'Falta información obligatoria. Revisa los pasos anteriores e inténtalo de nuevo.';
  if (typeof data !== 'object' || !data) return fallback;
  const d = data as Record<string, unknown>;
  const errField = d.error;
  if (typeof errField !== 'object' || !errField) return fallback;
  const err = errField as Record<string, unknown>;

  // Check for validation error code before inspecting the message
  const dataField = err.data;
  if (typeof dataField === 'object' && dataField) {
    const code = (dataField as Record<string, unknown>).code;
    if (code === 'BAD_REQUEST') return validationMsg;
  }

  const direct = typeof err.message === 'string' ? err.message : null;

  const jsonField = err.json;
  const nested =
    typeof jsonField === 'object' && jsonField
      ? (jsonField as Record<string, unknown>).message
      : null;
  const nestedStr = typeof nested === 'string' ? nested : null;

  const msg = direct ?? nestedStr;
  if (!msg) return fallback;

  if (msg.trim().startsWith('{') || msg.trim().startsWith('[')) return validationMsg;
  if (msg.length > 220) return fallback;

  return msg;
}

// Detects a CONFLICT code in a tRPC error response body, regardless of HTTP status.
function isConflictError(data: unknown): boolean {
  if (typeof data !== 'object' || !data) return false;
  const d = data as Record<string, unknown>;
  const errField = d.error;
  if (typeof errField !== 'object' || !errField) return false;
  const err = errField as Record<string, unknown>;

  // Shape 1: { error: { data: { code: 'CONFLICT' } } } — standard tRPC fetch response
  const dataField = err.data;
  if (typeof dataField === 'object' && dataField) {
    const code = (dataField as Record<string, unknown>).code;
    if (code === 'CONFLICT') return true;
  }

  // Shape 2: { error: { json: { data: { code: 'CONFLICT' } } } } — batch/legacy shape
  const jsonField = err.json;
  if (typeof jsonField === 'object' && jsonField) {
    const j = jsonField as Record<string, unknown>;
    const jDataField = j.data;
    if (typeof jDataField === 'object' && jDataField) {
      const code = (jDataField as Record<string, unknown>).code;
      if (code === 'CONFLICT') return true;
    }
    if (j.code === 'CONFLICT') return true;
  }

  return false;
}

export function IntakeWizard({ initialPlanIntent }: IntakeWizardProps) {
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlanIntent, setSelectedPlanIntent] = useState<ValidPlan | null>(
    initialPlanIntent ?? null
  );
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [formData, setFormData] = useState<WizardDataV2>({});
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInterpretingGroq, setIsInterpretingGroq] = useState(false);
  const [loaderComplete, setLoaderComplete] = useState(false);
  const [groqInterpretation, setGroqInterpretation] =
    useState<GroqIntakeInterpretation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailConflict, setEmailConflict] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const draft = loadDraftV2();
    if (draft) setShowDraftBanner(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlanDropdown(false);
      }
    }
    if (showPlanDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlanDropdown]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPlanDropdown(false);
    }
    if (showPlanDropdown) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showPlanDropdown]);

  function saveCurrentDraft(step: number, data: WizardDataV2) {
    saveDraftV2(step, {
      ...(data as object),
      selectedPlanIntent: selectedPlanIntent ?? undefined,
    } as Parameters<typeof saveDraftV2>[1]);
  }

  function handleRestoreDraft() {
    const draft = loadDraftV2();
    if (!draft) return;
    setCurrentStep(draft.step);
    const draftData = draft.data as WizardDataV2 & { selectedPlanIntent?: ValidPlan };
    const draftPlan = draftData.selectedPlanIntent;
    if (draftPlan && (VALID_PLANS as readonly string[]).includes(draftPlan)) {
      setSelectedPlanIntent(draftPlan);
    }
    setFormData(draftData as WizardDataV2);
    setShowDraftBanner(false);
  }

  function handleDiscardDraft() {
    clearDraftV2();
    setShowDraftBanner(false);
  }

  function handleStep1Next(data: Step1DataV2) {
    const updated = { ...formData, ...data };
    setFormData(updated);
    saveCurrentDraft(2, updated);
    setCurrentStep(2);
  }

  function handleStep2Next(data: Step2DataV2) {
    const updated = { ...formData, ...data };
    setFormData(updated);
    saveCurrentDraft(3, updated);
    setCurrentStep(3);
  }

  function handleStep3Next(data: Step3DataV2) {
    const updated = { ...formData, ...data };
    setFormData(updated);
    saveCurrentDraft(4, updated);
    setCurrentStep(4);
  }

  async function handleStep4Next(data: Step4DataV2) {
    const updated = { ...formData, ...data };
    setFormData(updated);
    setIsInterpretingGroq(true);
    setCurrentStep(5);

    try {
      const result = await interpretIntakeWithGroq({
        freeformBrief: data.freeformBrief,
        primaryProblems: (updated.primaryProblems ?? []) as string[],
        primaryGoals: (updated.primaryGoals ?? []) as string[],
        businessName: updated.businessName ?? '',
        industry: updated.industry ?? '',
        hasExistingSite: updated.hasExistingSite ?? false,
        selectedPlanIntent: selectedPlanIntent,
      });
      if (result.success) setGroqInterpretation(result.data);
    } catch {
      // Groq failed — deterministic fallback in server action
    }

    setLoaderComplete(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    setIsInterpretingGroq(false);
    setLoaderComplete(false);
    saveCurrentDraft(5, updated);
  }

  function handleStep5Next(data: Step5DataV2) {
    const updated = { ...formData, ...data };
    setFormData(updated);
    saveCurrentDraft(6, updated);
    setCurrentStep(6);
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleSelectPlan(plan: ValidPlan) {
    setSelectedPlanIntent(plan);
    setShowPlanDropdown(false);
    saveCurrentDraft(currentStep, { ...formData });
  }

  async function handleSubmit() {
    if (!termsAccepted) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setEmailConflict(false);
    try {
      const payload = {
        firstName: formData.firstName ?? '',
        lastName: formData.lastName ?? '',
        email: formData.email ?? '',
        whatsapp: formData.whatsapp ?? '',
        businessName: formData.businessName ?? '',
        industry: formData.industry ?? 'otro',
        whatYouOffer: formData.whatYouOffer ?? '',
        hasExistingSite: formData.hasExistingSite ?? false,
        currentUrl: formData.currentUrl ?? '',
        primaryProblems: formData.primaryProblems ?? [],
        primaryProblemsOther: formData.primaryProblemsOther ?? '',
        primaryGoals: formData.primaryGoals ?? [],
        freeformBrief: formData.freeformBrief ?? '',
        brandIdentityStatus: formData.brandIdentityStatus ?? 'no_identity',
        copyStatus: formData.copyStatus ?? 'needs_help',
        photosStatus: formData.photosStatus ?? 'needs_help',
        domainStatus: formData.domainStatus ?? 'not_sure',
        currentAccessStatus: formData.currentAccessStatus,
        selectedPlanIntent: selectedPlanIntent,
        clerkUserId: isSignedIn && user?.id ? user.id : undefined,
        groqInterpretation: groqInterpretation ?? undefined,
        termsAccepted: true as const,
        termsVersion: '1.0',
      };

      const res = await fetch('/api/trpc/intake.submitV2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Formato de transporte de superjson: el cuerpo viaja dentro de `json`.
        body: JSON.stringify({ json: payload }),
      });

      const raw = await res.json().catch(() => ({}));

      // Detect CONFLICT from HTTP status or from tRPC body
      if (res.status === 409 || isConflictError(raw)) {
        setEmailConflict(true);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(extractHumanError(raw));
      }

      clearDraftV2();

      if (isSignedIn) {
        router.push('/dashboard');
      } else {
        router.push('/acceder?redirect_url=/dashboard');
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No pudimos guardar tu solicitud. Inténtalo de nuevo.'
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {/* Draft banner */}
      {showDraftBanner && (
        <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 animate-wizard-step">
          <p className="text-sm text-white/55 font-body">
            Tienes un borrador guardado. ¿Continuar donde dejaste?
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <button
              onClick={handleRestoreDraft}
              className="text-sm text-white underline underline-offset-2 hover:text-white/70 transition-colors"
            >
              Continuar borrador
            </button>
            <button
              onClick={handleDiscardDraft}
              className="text-sm text-white/35 hover:text-white/55 transition-colors"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}

      {/* Plan intent banner */}
      {selectedPlanIntent && currentStep > 0 && (
        <div className="mb-5 relative" ref={dropdownRef}>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/60 font-body">
              Plan:{' '}
              <span className="ml-1 font-medium text-white/80">
                {PLAN_DISPLAY[selectedPlanIntent]}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowPlanDropdown((v) => !v)}
              className="text-xs text-white/35 underline underline-offset-2 hover:text-white/55 transition-colors"
            >
              Cambiar
            </button>
          </div>

          {showPlanDropdown && (
            <div className="absolute left-0 top-full mt-2 z-20 rounded-xl border border-white/[0.10] bg-[#0F1014] p-3 shadow-xl shadow-black/60 animate-wizard-step">
              <div className="flex flex-wrap gap-2">
                {VALID_PLANS.map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={
                      selectedPlanIntent === plan
                        ? 'rounded-lg bg-[#FF8C00] border border-transparent px-3 py-1.5 text-sm font-medium text-[#121212] cursor-pointer transition-colors'
                        : 'rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5 text-sm text-white/55 cursor-pointer transition-colors hover:border-white/20 hover:bg-white/[0.07]'
                    }
                  >
                    {PLAN_DISPLAY[plan]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {currentStep > 0 && (
        <div className="mb-7">
          <WizardProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
      )}

      {/* Step content */}
      <div key={currentStep} className="animate-wizard-step">
        {currentStep === 0 && (
          <Step0Intro onNext={() => setCurrentStep(1)} />
        )}
        {currentStep === 1 && (
          <Step1Contact
            defaultValues={formData}
            onNext={handleStep1Next}
            onBack={handleBack}
          />
        )}
        {currentStep === 2 && (
          <Step2Context
            defaultValues={formData}
            firstName={formData.firstName}
            onNext={handleStep2Next}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <Step3Features
            defaultValues={formData}
            onNext={handleStep3Next}
            onBack={handleBack}
          />
        )}
        {currentStep === 4 && (
          <Step4Proposal
            defaultValues={{ freeformBrief: formData.freeformBrief }}
            onNext={handleStep4Next}
            onBack={handleBack}
          />
        )}
        {currentStep === 5 && isInterpretingGroq && <WizardLoader complete={loaderComplete} />}
        {currentStep === 5 && !isInterpretingGroq && (
          <Step5Materials
            defaultValues={formData}
            hasExistingSite={formData.hasExistingSite ?? false}
            onNext={handleStep5Next}
            onBack={handleBack}
          />
        )}
        {currentStep === 6 && (
          <Step6Summary
            formData={formData}
            selectedPlanIntent={selectedPlanIntent}
            groqInterpretation={groqInterpretation}
            isSubmitting={isSubmitting}
            submitError={submitError}
            emailConflict={emailConflict}
            termsAccepted={termsAccepted}
            onTermsAccepted={setTermsAccepted}
            onSubmit={handleSubmit}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
