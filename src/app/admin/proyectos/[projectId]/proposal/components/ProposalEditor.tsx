'use client';

// Editor de propuesta para Xavier
// Muestra el borrador del intake y permite personalizar antes de enviar
// La propuesta se envía manualmente por email + WhatsApp (no automático)
// muestra bloques del catálogo (Incluido / Add-on / Cotización)

import { useState } from 'react';
import type { IntakeSnapshot } from '@/db/schema/projects';
import type { ProposalCatalogSnapshot } from '@/lib/catalog/types';

/** Legacy add-on labels kept for backward-compat with old projects that have suggestedAddOns set. */
const LEGACY_ADD_ON_LABELS: Record<string, { label: string; price: number }> = {
  C01_copywriting: { label: 'Redacción profesional (IA + revisión)', price: 149 },
  C02_blog_engine: { label: 'Motor de blog activado', price: 129 },
  I01_crm_sync: { label: 'Integración CRM', price: 99 },
  I02_advanced_booking: { label: 'Agenda multi-empleado', price: 129 },
};

interface ProposalEditorProps {
  project: {
    id: string;
    plan: string;
    monthlyPriceCents: number;
    setupFeeCents: number;
    suggestedAddOns: string[] | null;
    intakeSnapshot: IntakeSnapshot | null;
    internalNotes: string | null;
    clientName: string;
    clientEmail: string;
    clientWhatsapp: string | null;
    businessName: string;
    industry: string;
    /** catalog snapshot attached to the proposal. May be null for old projects. */
    catalogSnapshot?: ProposalCatalogSnapshot | null;
    snapshotSource?: 'project_snapshot' | 'quote_snapshot' | 'live_fallback' | 'legacy_none';
  };
}

export function ProposalEditor({ project }: ProposalEditorProps) {
  const intake = project.intakeSnapshot;
  const snapshot = project.catalogSnapshot ?? null;

  const [personalNote, setPersonalNote] = useState('');
  const [internalNotes, setInternalNotes] = useState(project.internalNotes ?? '');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // if catalog snapshot present, drive add-ons from there.
  // Otherwise fall back to legacy suggestedAddOns for old projects.
  const hasSnapshot = !!snapshot;

  // Legacy add-on selection (only used when no snapshot)
  const [selectedLegacyAddOns, setSelectedLegacyAddOns] = useState<string[]>(
    !hasSnapshot ? (project.suggestedAddOns ?? []) : []
  );

  // selected paid add-on codes from catalog snapshot
  const [selectedCatalogAddOns, setSelectedCatalogAddOns] = useState<string[]>(
    hasSnapshot ? snapshot.recommendedAddOns.map((a) => a.code) : []
  );

  const monthlyUsd = project.monthlyPriceCents / 100;
  const setupUsd = project.setupFeeCents / 100;

  // Total for legacy path
  const legacyAddOnTotal = selectedLegacyAddOns.reduce(
    (sum, key) => sum + (LEGACY_ADD_ON_LABELS[key]?.price ?? 0),
    0
  );

  // Total for catalog path (only paid add-ons that are selected)
  const catalogAddOnTotal = hasSnapshot
    ? snapshot.recommendedAddOns
        .filter((a) => selectedCatalogAddOns.includes(a.code))
        .reduce((sum, a) => sum + (a.priceCents ?? 0) / 100, 0)
    : 0;

  const addOnTotal = hasSnapshot ? catalogAddOnTotal : legacyAddOnTotal;
  const totalPrimerPago = setupUsd + monthlyUsd + addOnTotal;

  function toggleLegacyAddOn(key: string) {
    setSelectedLegacyAddOns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleCatalogAddOn(code: string) {
    setSelectedCatalogAddOns((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleSendProposal() {
    setIsSending(true);
    setSendError(null);
    try {
      const selectedAddOns = hasSnapshot ? selectedCatalogAddOns : selectedLegacyAddOns;
      const res = await fetch('/api/trpc/admin.sendProposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            projectId: project.id,
            personalNote,
            selectedAddOns,
            internalNotes,
            snapshotSource: project.snapshotSource,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `Error ${res.status}`);
      }
      setSent(true);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'Error al enviar la propuesta. Intenta de nuevo.'
      );
    } finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-800">
          ✓ Propuesta enviada a {project.clientEmail}
        </p>
        <p className="mt-1 text-sm text-green-700">
          El cliente recibirá un email. Recuerda enviar el mensaje de WhatsApp también.
        </p>
        {project.clientWhatsapp && (
          <a
            href={`https://wa.me/${project.clientWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hola ${project.clientName.split(' ')[0]}, te acabo de enviar la propuesta para ${project.businessName} por email. Cualquier duda, aquí estoy.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Enviar WhatsApp de seguimiento →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen del intake */}
      {intake && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Resumen del intake</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-400">Industria</dt>
              <dd className="text-gray-700 capitalize">{intake.industry}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Ubicación</dt>
              <dd className="text-gray-700">{intake.location}</dd>
            </div>
            {intake.currentUrl && (
              <div className="col-span-2">
                <dt className="text-gray-400">Sitio actual</dt>
                <dd>
                  <a
                    href={intake.currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {intake.currentUrl}
                  </a>
                </dd>
              </div>
            )}
            {intake.freeformBrief && (
              <div className="col-span-2">
                <dt className="text-gray-400">Brief del cliente</dt>
                <dd className="mt-0.5 rounded bg-gray-50 p-2 text-gray-700">
                  {intake.freeformBrief}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Catalog snapshot blocks ─────────────────── */}
      {hasSnapshot && (
        <>
          {project.snapshotSource === 'live_fallback' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-4">
              <p className="text-sm text-amber-800 font-medium flex gap-2 items-center">
                <span>⚠</span> Este proyecto no tiene snapshot histórico. Se está usando el catálogo actual solo como fallback.
              </p>
            </div>
          )}
          {snapshot.generatedAt && project.snapshotSource !== 'live_fallback' && (
            <p className="text-xs text-gray-500 mb-2">
              Snapshot comercial generado: {new Date(snapshot.generatedAt).toLocaleString()}
            </p>
          )}

          {/* Sección 1: Incluido en tu plan */}
          {snapshot.included.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-emerald-800">
                ✓ Incluido en tu plan
              </h2>
              <ul className="space-y-1">
                {snapshot.included.map((cap) => (
                  <li key={cap.code} className="flex items-start justify-between text-sm">
                    <span className="text-emerald-900">{cap.publicName || cap.name}</span>
                    {cap.listPriceCents > 0 && (
                      <span className="ml-4 whitespace-nowrap text-xs text-emerald-600">
                        Valor: ${(cap.listPriceCents / 100).toLocaleString('en-US')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sección 2: Recomendado como add-on */}
          {snapshot.recommendedAddOns.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-gray-700">
                Recomendado como add-on (selecciona los que aplican)
              </h2>
              <div className="space-y-2">
                {snapshot.recommendedAddOns.map((cap) => (
                  <label
                    key={cap.code}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 hover:border-gray-300 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCatalogAddOns.includes(cap.code)}
                      onChange={() => toggleCatalogAddOn(cap.code)}
                      className="accent-gray-900"
                    />
                    <span className="flex-1 text-sm text-gray-700">{cap.publicName || cap.name}</span>
                    {cap.priceCents != null && (
                      <span className="text-sm font-medium text-gray-900">
                        +${(cap.priceCents / 100).toLocaleString('en-US')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Sección 3: Requiere cotización */}
          {snapshot.quoteRequired.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-800">
                ⚠ Requiere cotización
              </h2>
              <ul className="space-y-1">
                {snapshot.quoteRequired.map((cap) => (
                  <li key={cap.code} className="text-sm text-amber-900">
                    {cap.publicName || cap.name}
                    <span className="ml-2 text-xs text-amber-600">— precio a confirmar</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Plan y precios */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">Plan y precio</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Plan {project.plan}</span>
            <span className="font-medium">${monthlyUsd}/mes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fee de configuración</span>
            <span className="font-medium">${setupUsd} (único)</span>
          </div>

          {/* catalog add-ons in total */}
          {hasSnapshot && selectedCatalogAddOns.length > 0 && snapshot.recommendedAddOns
            .filter((a) => selectedCatalogAddOns.includes(a.code))
            .map((cap) => (
              <div key={cap.code} className="flex justify-between text-gray-500">
                <span>{cap.publicName || cap.name}</span>
                {cap.priceCents != null && <span>+${(cap.priceCents / 100).toLocaleString('en-US')}</span>}
              </div>
            ))
          }

          {/* Legacy: old suggestedAddOns (only when no snapshot) */}
          {!hasSnapshot && selectedLegacyAddOns.map((key) => (
            <div key={key} className="flex justify-between text-gray-500">
              <span>{LEGACY_ADD_ON_LABELS[key]?.label ?? key}</span>
              <span>+${LEGACY_ADD_ON_LABELS[key]?.price ?? '?'}</span>
            </div>
          ))}

          <div className="border-t border-gray-100 pt-1.5">
            <div className="flex justify-between font-semibold">
              <span>Total primer pago</span>
              <span>${totalPrimerPago.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
            </div>
            {hasSnapshot && snapshot.included.length > 0 && (
              <p className="mt-1 text-xs text-emerald-600">
                + Valor incluido en tu plan (no cobrado al cliente)
              </p>
            )}
            {hasSnapshot && snapshot.quoteRequired.length > 0 && (
              <p className="mt-0.5 text-xs text-amber-600">
                + {snapshot.quoteRequired.length} capacidades requieren cotización separada
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Legacy add-ons selector — only shown for old projects without snapshot */}
      {!hasSnapshot && Object.keys(LEGACY_ADD_ON_LABELS).length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-gray-700">Add-ons (opcional)</h2>
          <div className="space-y-2">
            {Object.entries(LEGACY_ADD_ON_LABELS).map(([key, { label, price }]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 hover:border-gray-300 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedLegacyAddOns.includes(key)}
                  onChange={() => toggleLegacyAddOn(key)}
                  className="accent-gray-900"
                />
                <span className="flex-1 text-sm text-gray-700">{label}</span>
                <span className="text-sm font-medium text-gray-900">+${price}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Nota personal de Xavier */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Nota personal para el cliente
        </label>
        <p className="mt-0.5 text-xs text-gray-400">
          Aparecerá en el email de propuesta. Personalízala para este cliente específico.
        </p>
        <textarea
          rows={4}
          value={personalNote}
          onChange={(e) => setPersonalNote(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder={`Hola ${project.clientName.split(' ')[0]}, vi tu perfil y me parece que el Plan ${project.plan} es perfecto para ${project.businessName} porque...`}
        />
      </div>

      {/* Notas internas */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notas internas <span className="font-normal text-gray-400">(solo tú las ves)</span>
        </label>
        <textarea
          rows={2}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Recordatorios, contexto, flags internos..."
        />
      </div>

      {/* Error de envío */}
      {sendError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {sendError}
        </div>
      )}

      {/* CTA de envío */}
      <button
        type="button"
        onClick={handleSendProposal}
        disabled={isSending}
        className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSending ? 'Enviando...' : 'Enviar propuesta al cliente →'}
      </button>

      <p className="text-center text-xs text-gray-400">
        El cliente recibirá un email con la propuesta. Después, envía el mensaje de
        WhatsApp para avisarle. Válida por 7 días.
      </p>
    </div>
  );
}
