'use client';

import { useState } from 'react';
import type { PortalCapabilityCard } from '@/lib/catalog/portal-types';
import type { CatalogDecision, CatalogRequestKind } from '@/lib/catalog/types';
import { previewCatalogRequest, submitCatalogRequest } from '../actions';
import { PartialConfirmStep } from './PartialConfirmStep';

const REQUEST_KIND_LABELS: Partial<Record<CatalogRequestKind, string>> = {
  change:       'Cambio',
  correction:   'Corrección',
  expansion:    'Expansión',
  maintenance:  'Mantenimiento',
  reactivation: 'Reactivación',
};

const DECISION_COPY: Record<string, { label: string; description: string; accent: string }> = {
  included_setup:    { label: 'Incluido',           description: 'Incluido en la entrega inicial de tu plan.',                  accent: 'text-green-400' },
  included_allowance:{ label: 'Incluido',           description: 'Disponible dentro de tu cupo de este periodo.',               accent: 'text-green-400' },
  included_warranty: { label: 'Garantía activa',    description: 'Esto entra como corrección de garantía.',                     accent: 'text-green-400' },
  paid_addon:        { label: 'Con costo adicional', description: 'Este cambio tiene costo adicional.',                          accent: 'text-amber-400' },
  quote_required:    { label: 'Requiere cotización', description: 'Necesitamos revisar esto antes de darte precio.',             accent: 'text-blue-400' },
  partial_available: { label: 'Disponibilidad parcial', description: 'Parte de tu solicitud está incluida, el resto varía.',    accent: 'text-yellow-400' },
  unavailable:       { label: 'No disponible',      description: 'Esta capacidad no está disponible para tu plan actual.',      accent: 'text-white/40' },
  blocked_duplicate: { label: 'Ya entregado',       description: 'Esto ya fue entregado. Si quieres modificarlo, crea una solicitud de cambio.', accent: 'text-white/40' },
};

type Step = 'form' | 'loading' | 'preview' | 'partial' | 'submitting' | 'done' | 'error';

interface RequestFormDialogProps {
  card: PortalCapabilityCard;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestFormDialog({
  card,
  projectId,
  onClose,
  onSuccess,
}: RequestFormDialogProps) {
  const availableKinds = (
    card.allowedRequestKinds.length > 0
      ? card.allowedRequestKinds.filter((k) => k !== 'initial_delivery')
      : (['change', 'correction', 'expansion', 'maintenance', 'reactivation'] as CatalogRequestKind[])
  ) as CatalogRequestKind[];

  const [step, setStep] = useState<Step>('form');
  const [requestKind, setRequestKind] = useState<CatalogRequestKind>(availableKinds[0] ?? 'change');
  const [quantity, setQuantity] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<CatalogDecision | null>(null);
  const [error, setError] = useState('');
  const [acceptedPartial, setAcceptedPartial] = useState(false);
  const [acceptedQuantity, setAcceptedQuantity] = useState<number | undefined>(undefined);

  async function handlePreview() {
    setError('');
    setStep('loading');
    try {
      const result = await previewCatalogRequest({
        projectId,
        catalogItemId: card.id,
        requestKind,
        quantity,
      });
      setPreview(result);
      if (result.nextAction === 'show_partial_options') {
        setStep('partial');
      } else {
        setStep('preview');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al evaluar tu solicitud.');
      setStep('form');
    }
  }

  function handlePartialConfirm(qty: number) {
    setAcceptedPartial(true);
    setAcceptedQuantity(qty);
    setStep('preview');
  }

  async function handleSubmit() {
    if (!preview) return;
    setError('');
    setStep('submitting');
    try {
      await submitCatalogRequest({
        projectId,
        catalogItemId: card.id,
        requestKind,
        quantity,
        title: title.trim(),
        description: description.trim(),
        acceptedPartial,
        acceptedQuantity,
        originalQuantity: quantity,
      });
      setStep('done');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud.';
      if (msg === 'PARTIAL_REQUIRES_CONFIRMATION' && preview) {
        setStep('partial');
      } else {
        setError(msg);
        setStep('preview');
      }
    }
  }

  const decisionCopy = preview
    ? (DECISION_COPY[preview.decision] ?? { label: preview.decision, description: '', accent: 'text-white/60' })
    : null;

  const isLoading = step === 'loading' || step === 'submitting';
  const canPreview = title.trim().length >= 5 && description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0F1014] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-[0.08em]">
              Nueva solicitud
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-white">
              {card.publicName}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-lg leading-none text-white/20 transition-colors hover:text-white/50"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form step */}
        {step === 'form' && (
          <div className="space-y-3">
            {availableKinds.length > 1 && (
              <div>
                <label
                  className="mb-1.5 block text-xs text-white/40"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Tipo de solicitud
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableKinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setRequestKind(kind)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                        requestKind === kind
                          ? 'border-white/25 bg-white/10 text-white'
                          : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {REQUEST_KIND_LABELS[kind] ?? kind}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label
                className="mb-1.5 block text-xs text-white/40"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Cantidad
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs text-white/40"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Título
              </label>
              <input
                type="text"
                placeholder="¿Qué necesitas exactamente?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs text-white/40"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Descripción
              </label>
              <textarea
                placeholder="Describe con detalle lo que necesitas (colores, texto, referencia, etc.)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <p className="text-xs text-white/20">
              Esta evaluación es preliminar. Confirmaremos disponibilidad al enviar tu solicitud.
            </p>

            <button
              onClick={handlePreview}
              disabled={!canPreview}
              className="w-full rounded-md bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ver evaluación
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
            <p className="text-sm text-white/40">
              {step === 'submitting' ? 'Enviando solicitud...' : 'Evaluando...'}
            </p>
          </div>
        )}

        {/* Partial confirmation */}
        {step === 'partial' && preview && (
          <PartialConfirmStep
            decision={preview}
            originalQuantity={quantity}
            onConfirm={handlePartialConfirm}
            onCancel={() => setStep('form')}
          />
        )}

        {/* Preview */}
        {step === 'preview' && preview && decisionCopy && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p
                className={`text-sm font-medium ${decisionCopy.accent}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {decisionCopy.label}
              </p>
              {decisionCopy.description && (
                <p className="mt-1 text-sm text-white/50">
                  {decisionCopy.description}
                </p>
              )}
              {preview.totalPriceCents != null && preview.totalPriceCents > 0 && (
                <p
                  className="mt-2 text-base font-semibold text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  ${(preview.totalPriceCents / 100).toFixed(2)}
                </p>
              )}
              {preview.totalPriceCents === 0 && (
                <p
                  className="mt-2 text-sm font-medium text-green-400"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  $0.00
                </p>
              )}
              {acceptedPartial && acceptedQuantity && (
                <p className="mt-1.5 text-xs text-white/30">
                  Cantidad ajustada: {acceptedQuantity}
                </p>
              )}
            </div>

            <p className="text-xs text-white/20">
              Esta evaluación es preliminar. Confirmaremos disponibilidad al enviar tu solicitud.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('form')}
                className="flex-1 rounded-md border border-white/10 px-4 py-2 text-sm text-white/50 transition-colors hover:bg-white/5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Editar
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 rounded-md bg-[#d5ff02] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Enviar solicitud
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-3xl">✓</p>
            <p
              className="text-sm font-medium text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Solicitud enviada
            </p>
            <p className="text-sm text-white/40">
              Confirmaremos disponibilidad y te notificaremos los próximos pasos.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-md border border-white/15 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
