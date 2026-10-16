'use client';

// Step 4 — Checkout self-serve (reemplaza Step4Proposal para el flujo NO-LEGACY)
// LEGACY: muestra CTA de WhatsApp (sin Calendly)
// NO-LEGACY: muestra resumen del plan + términos + PayPal subscription buttons

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PayPalButtons,
  PayPalScriptProvider,
} from '@paypal/react-paypal-js';
type OnApproveData = { subscriptionID?: string | null; orderID?: string | null };
import type { IntakeFormData, PlanDetectionResult } from '@/lib/intake/types';
import { getPlanPriceCents } from '@/lib/intake/plan-detector';
import { PlanBadge } from '../PlanBadge';
import { AddOnSuggestions } from '../AddOnSuggestions';
import { clearDraft } from '@/lib/intake/auto-save';
import { Spinner } from '@/components/ui';
import { whatsappUrl, formatWhatsAppDisplay } from '@/lib/config/contact';

// Texto de los términos clave
const TERMS_BULLETS = [
  'Permanencia mínima: 6 meses. Cancelar antes implica una penalidad del 50% del valor restante del contrato.',
  'Después de los 6 meses, puedes cancelar con aviso escrito de 30 días sin penalidad adicional.',
  'No se garantiza un resultado específico de negocio — el diseño profesional mejora la presencia digital.',
  'Las revisiones gratuitas están limitadas a 72 horas hábiles desde el lanzamiento del sitio.',
  'Las solicitudes de cambio posteriores se procesan como tickets pagados.',
];

interface Step4CheckoutProps {
  formData: IntakeFormData;
  detectedPlan: PlanDetectionResult;
  onBack: () => void;
}

function buildWhatsAppText(formData: IntakeFormData): string {
  return `Hola Xavier, soy ${formData.fullName} de ${formData.businessName}. Completé el formulario en tu web y me interesa un proyecto personalizado (LEGACY). Mi email es ${formData.email}.${formData.freeformBrief ? ` Brief: ${formData.freeformBrief}` : ''}`;
}

export function Step4Checkout({
  formData,
  detectedPlan,
  onBack,
}: Step4CheckoutProps) {
  const router = useRouter();
  const isLegacy = detectedPlan.requiresReview;
  const monthlyCents = getPlanPriceCents(detectedPlan.plan);

  const [termsChecked, setTermsChecked] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<number | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const waText = buildWhatsAppText(formData);

  function handleTermsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    setTermsChecked(checked);
    setTermsAcceptedAt(checked ? Date.now() : null);
    setError(null);
  }

  const handleCreateSubscription = useCallback(
    async (_data: Record<string, unknown>, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }) => {
      const res = await fetch(`/api/paypal/plan-id?plan=${detectedPlan.plan}`);
      if (!res.ok) throw new Error('No se pudo obtener el plan de PayPal');
      const { planId } = (await res.json()) as { planId: string };
      return actions.subscription.create({ plan_id: planId });
    },
    [detectedPlan.plan]
  );

  const handleApprove = useCallback(
    async (data: OnApproveData) => {
      setIsProcessing(true);
      setError(null);
      try {
        const res = await fetch('/api/paypal/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: data.subscriptionID,
            plan: detectedPlan.plan,
            intakeSnapshot: formData,
            termsVersion: '1.0',
            termsAcceptedAt: new Date(termsAcceptedAt!).toISOString(),
          }),
        });

        if (!res.ok) throw new Error('Error procesando el pago');

        clearDraft();

        // Redirigir a la página de confirmación post-pago
        router.push('/empezar/confirmado?status=PAYMENT_RECEIVED');
      } catch {
        setError('Ocurrió un error procesando el pago. Por favor intenta de nuevo.');
        setIsProcessing(false);
      }
    },
    [detectedPlan.plan, formData, termsAcceptedAt, router]
  );

  const handlePayPalError = useCallback((err: Record<string, unknown>) => {
    console.error('[PayPal]', err);
    setError('Error en el pago de PayPal. Por favor intenta de nuevo.');
  }, []);

  // ─── Ruta LEGACY ────────────────────────────────────────────
  if (isLegacy) {
    return (
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">
            Tu proyecto merece una propuesta a medida
          </h2>
          <p className="mt-2 text-gray-500">
            Basándome en lo que me contaste, prefiero prepararte algo específico antes de darte un precio.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-amber-800">
            Tu proyecto incluye desarrollo personalizado. Antes de darte un número,
            prefiero entender bien lo que necesitas para no sobre-prometerte ni
            quedarte corto.
          </p>

          <div className="mt-5 space-y-3">
            <a
              href={whatsappUrl(waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Enviar brief por WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300"
          >
            Atrás
          </button>
        </div>
      </div>
    );
  }

  // ─── Ruta NO-LEGACY (self-serve) ────────────────────────────
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Tu propuesta</h2>
        <p className="mt-2 text-gray-500">
          Basado en tus respuestas, esto es lo que te recomiendo.
        </p>
      </div>

      {/* Plan summary card */}
      <div className="rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <PlanBadge plan={detectedPlan.plan} />
            <p className="mt-3 text-3xl font-bold text-gray-900">
              ${monthlyCents / 100}
              <span className="text-base font-normal text-gray-500">/mes</span>
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              + $50 USD de configuración (pago único)
            </p>
          </div>
        </div>

        {/* Razones del plan */}
        <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
          {detectedPlan.reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {reason}
            </div>
          ))}
        </div>

        {/* Que incluye */}
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700">¿Qué incluye?</p>
          <ul className="mt-2 space-y-1">
            <li>Diseño y desarrollo completo en 72 horas hábiles</li>
            <li>Hosting y mantenimiento incluidos</li>
            <li>Hasta 2 rondas de revisiones</li>
            <li>Soporte por WhatsApp</li>
          </ul>
        </div>

        {/* Add-ons sugeridos */}
        {detectedPlan.suggestedAddOns.length > 0 && (
          <AddOnSuggestions addOns={detectedPlan.suggestedAddOns} />
        )}
      </div>

      {/* Seccion de terminos */}
      <div className="mt-6 rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900">Términos del servicio</h3>

        <ul className="mt-3 space-y-2">
          {TERMS_BULLETS.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-0.5 shrink-0 text-gray-400">-</span>
              {bullet}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setShowContract(true)}
          className="mt-3 inline-block text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors duration-200"
        >
          Ver contrato completo
        </button>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            id="terms-checkbox"
            checked={termsChecked}
            onChange={handleTermsChange}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span className="text-sm text-gray-700">
            Acepto los términos del servicio bajo la{' '}
            <strong>Ley 126-02 de Comercio Electrónico (RD)</strong>. Entiendo
            que el plan seleccionado tiene un costo de{' '}
            <strong>${monthlyCents / 100} USD/mes</strong> más{' '}
            <strong>$50 USD de configuración</strong> (incluido en el primer
            cobro), con permanencia mínima de 6 meses.
          </span>
        </label>
      </div>

      {/* Spinner de procesamiento */}
      {isProcessing && (
        <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-gray-200 p-6">
          <Spinner size="sm" label="Activando tu cuenta" />
          <span className="text-sm text-gray-600" aria-hidden="true">Activando tu cuenta...</span>
        </div>
      )}

      {/* Error */}
      {error && !isProcessing && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => { setError(null); setRetryKey(k => k + 1); }}
            className="mt-2 text-sm font-medium text-red-700 underline underline-offset-2"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* Botones de pago */}
      {!isProcessing && (
        <div className="mt-6">
          {termsChecked ? (
            <PayPalScriptProvider
              key={retryKey}
              options={{
                clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
                vault: true,
                intent: 'subscription',
                currency: 'USD',
                enableFunding: 'googlepay,applepay,venmo',
              }}
            >
              <PayPalButtons
                style={{ layout: 'vertical', color: 'black', shape: 'rect' }}
                createSubscription={handleCreateSubscription}
                onApprove={handleApprove}
                onError={handlePayPalError}
              />
            </PayPalScriptProvider>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-gray-200 px-6 py-3 text-sm font-medium text-gray-400 cursor-not-allowed"
            >
              Acepta los términos para continuar
            </button>
          )}
        </div>
      )}

      {/* Footer de seguridad */}
      <p className="mt-4 text-center text-xs text-gray-400">
        Pago seguro procesado por PayPal. Cancela cuando quieras.
      </p>

      {/* Boton atras */}
      <div className="mt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 disabled:opacity-50"
        >
          Atrás
        </button>
      </div>

      {/* Modal contrato completo */}
      {showContract && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contract-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowContract(false)}
            aria-hidden="true"
          />

          {/* Contenido */}
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 id="contract-modal-title" className="text-lg font-semibold text-gray-900">
                Contrato de Servicios — QUIRICO STUDIOS
              </h2>
              <button
                type="button"
                onClick={() => setShowContract(false)}
                aria-label="Cerrar contrato"
                className="ml-4 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
              <p className="text-xs text-gray-400">Última actualización: marzo 2026 · Ley 126-02 (Comercio Electrónico, RD)</p>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">1. Partes del contrato</h3>
                <p>Este contrato es entre <strong>QUIRICO STUDIOS</strong> (proveedor) y el cliente que acepta estos términos al completar el proceso de contratación en línea. La aceptación mediante checkbox tiene plena validez legal según la Ley 126-02 de Comercio Electrónico de la República Dominicana.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">2. Servicio contratado</h3>
                <p>El proveedor se compromete a diseñar, desarrollar y mantener un sitio web profesional según el plan seleccionado (BASIC, PRO o BUSINESS). El sitio será entregado en estado funcional dentro de los plazos establecidos, condicionado a la entrega completa de materiales por parte del cliente.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">3. Permanencia mínima y facturación</h3>
                <p>El servicio tiene una <strong>permanencia mínima obligatoria de seis (6) meses</strong> contados desde la fecha de inicio del servicio. La suscripción se factura mensualmente mediante PayPal de forma automática.</p>
                <p className="mt-2"><strong>Cancelación antes de los 6 meses:</strong> Si solicitas cancelar antes de cumplir los 6 meses de compromiso, deberás abonar una penalidad equivalente al <strong>50% del valor restante del contrato</strong> hasta completar los 6 meses.</p>
                <p className="mt-1 text-gray-500 text-xs italic">Ejemplo: Plan BASIC ($49/mes), cancelación en el mes 3 → 3 meses restantes × $49 × 50% = $73.50 USD de penalidad.</p>
                <p className="mt-2"><strong>Cancelación después de los 6 meses:</strong> Puedes cancelar en cualquier momento con un aviso escrito de <strong>30 días de anticipación</strong>, sin penalidad adicional. La cancelación debe solicitarse por escrito (email o canal oficial de soporte) — no se aceptan cancelaciones verbales ni por WhatsApp.</p>
                <p className="mt-2">El cargo de configuración inicial (<em>setup fee</em>) está incluido en el primer mes y no se factura por separado.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">4. Plazos de entrega</h3>
                <p>El plazo de entrega inicia una vez el cliente haya subido todos los materiales requeridos (logo, fotos, colores, textos). El proveedor tiene hasta <strong>72 horas hábiles</strong> para hacer disponible el sitio en staging. El SLA de 72h hábiles aplica desde el deploy en producción (LIVE), no desde staging.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">5. Revisiones gratuitas</h3>
                <p>Se incluyen revisiones ilimitadas durante las primeras <strong>72 horas hábiles</strong> posteriores al lanzamiento del sitio en producción. Las solicitudes de cambio recibidas fuera de este período se procesan como tickets pagados según la tarifa vigente.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">6. Propiedad intelectual y materiales</h3>
                <p>El cliente garantiza ser titular o tener los derechos de uso de todos los materiales (imágenes, logotipos, textos) que entregue al proveedor. El proveedor no asume responsabilidad por infracciones derivadas de materiales provistos por el cliente.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">7. Suspensión por impago</h3>
                <p>Si un pago no se procesa en la fecha correspondiente, se otorga automáticamente un período de gracia de <strong>3 días calendario</strong>. Transcurrido ese período sin regularización, el sitio será suspendido y dejará de ser accesible al público.</p>
                <p className="mt-1">La reactivación dentro de los 30 días posteriores a la suspensión requiere: (a) el monto adeudado, (b) un cargo de reactivación de <strong>$25 USD</strong>, y (c) el período mensual vigente. Pasados los 30 días de suspensión, Xavier puede eliminar el sitio y sus datos sin responsabilidad por la pérdida de contenido.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">8. Limitación de responsabilidad</h3>
                <p>El proveedor no garantiza resultados específicos de negocio (ventas, leads, posicionamiento SEO). El diseño profesional mejora la presencia digital, pero los resultados dependen de factores externos al alcance de este contrato.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">9. Soporte</h3>
                <p>El soporte se brinda vía WhatsApp al número <strong>{formatWhatsAppDisplay()}</strong> en horario hábil (lunes a viernes, 9am–6pm hora RD). Incidencias urgentes pueden reportarse a través del portal de cliente.</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">10. Ley aplicable</h3>
                <p>Este contrato se rige por las leyes de la República Dominicana, en particular la Ley 126-02 sobre Comercio Electrónico, Documentos y Firmas Digitales. Cualquier controversia se someterá a los tribunales competentes de Santo Domingo, RD.</p>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContract(false)}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors duration-200"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
