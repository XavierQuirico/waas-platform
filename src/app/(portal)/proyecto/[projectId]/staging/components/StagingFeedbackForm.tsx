'use client';

import { useState } from 'react';

interface StagingFeedbackFormProps {
  projectId: string;
  revisionNumber: number;
  canSubmit: boolean;
  disabledReason?: string;
  alreadyApproved?: boolean;
}

export function StagingFeedbackForm({
  projectId,
  revisionNumber,
  canSubmit,
  disabledReason,
  alreadyApproved,
}: StagingFeedbackFormProps) {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAction, setSubmittedAction] = useState<'approved' | 'revision' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingApproval, setConfirmingApproval] = useState(false);

  const canRequestRevision = feedback.trim().length >= 10;

  async function handleRequestRevision() {
    if (!canRequestRevision) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trpc/projects.submitStagingFeedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            projectId,
            items: [{ section: 'General', status: 'changes', comment: feedback.trim() }],
            allApproved: false,
          },
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg =
          json?.error?.json?.message ??
          json?.error?.message ??
          json?.message ??
          null;
        throw new Error(msg ?? 'Error al enviar feedback');
      }
      setSubmittedAction('revision');
      setSubmitted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : null;
      setError(msg ?? 'No pudimos enviar tu respuesta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleApproveConfirmed() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trpc/projects.approveStagingAll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            projectId,
            items: [{ section: 'General', status: 'approved' }],
            allApproved: true,
          },
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg =
          json?.error?.json?.message ??
          json?.error?.message ??
          json?.message ??
          null;
        throw new Error(msg ?? 'Error al aprobar');
      }
      setSubmittedAction('approved');
      setSubmitted(true);
      setConfirmingApproval(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : null;
      setError(msg ?? 'No pudimos enviar tu respuesta. Intenta de nuevo.');
      setConfirmingApproval(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 text-center">
        <p className="font-semibold text-green-400">
          {submittedAction === 'approved'
            ? 'Aprobación enviada. Xavier preparará la publicación.'
            : 'Feedback enviado. Xavier aplicará tus cambios y te avisará cuando haya un nuevo preview.'}
        </p>
      </div>
    );
  }

  if (alreadyApproved) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5 text-center space-y-1">
        <p className="text-sm font-semibold text-green-400">Ya enviaste tu aprobación.</p>
        <p className="text-xs text-white/40">
          Xavier recibió tu aprobación y preparará la publicación del sitio.
        </p>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
        <p className="text-sm text-white/50">
          {disabledReason ?? 'El formulario no está disponible en este momento.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {revisionNumber > 0 && (
        <p className="text-xs text-white/30">Revisión #{revisionNumber}</p>
      )}

      <div>
        <label
          htmlFor="staging-feedback"
          className="mb-1.5 block text-sm font-medium text-white/60"
        >
          Cambios que quieres solicitar
        </label>
        <textarea
          id="staging-feedback"
          rows={5}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Ejemplo: En la sección de contacto, cambia el texto del botón. En el hero, usa una foto más cercana..."
          className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        {feedback.trim().length > 0 && feedback.trim().length < 10 && (
          <p className="mt-1 text-xs text-amber-400">
            Describe el cambio con un poco más de detalle (mínimo 10 caracteres).
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {confirmingApproval ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/70">
            Xavier recibirá tu aprobación y preparará la publicación. Esto no publica
            automáticamente el sitio.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirmingApproval(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApproveConfirmed}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-[#FF8C00] px-4 py-2.5 text-sm font-semibold text-[#121212] transition-colors hover:bg-[#e67e22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,140,0,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? 'Procesando...' : 'Sí, aprobar preview'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleRequestRevision}
            disabled={!canRequestRevision || isSubmitting}
            className="w-full rounded-lg border border-white/20 bg-white/[0.02] px-6 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar cambios'}
          </button>

          <button
            type="button"
            onClick={() => setConfirmingApproval(true)}
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-[#121212] transition-colors hover:bg-[#e67e22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,140,0,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aprobar preview
          </button>
        </div>
      )}
    </div>
  );
}
