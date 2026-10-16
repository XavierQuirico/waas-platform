'use client';

import { useState, useRef, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitChangeRequest, previewChangeRequest } from './actions';
import type { ChangeInterpretationResult } from '@/lib/tickets/interpretChangeRequest';
import { CONFIDENCE_THRESHOLDS } from '@/lib/tickets/interpretChangeRequest';

interface ChangeRequestComposerProps {
  projectId: string;
  projectPlan: string;
  productionUrl: string | null;
}

const MIN_CHARS = 20;
const MAX_CHARS = 2000;

function CharCount({ count }: { count: number }) {
  const nearLimit = count > MAX_CHARS * 0.9;
  const overLimit = count > MAX_CHARS;
  return (
    <span
      className={`text-xs tabular-nums font-inter-tight transition-colors ${
        overLimit
          ? 'text-red-400'
          : nearLimit
            ? 'text-amber-400'
            : 'text-white/25'
      }`}
    >
      {count}/{MAX_CHARS}
    </span>
  );
}

function AiSuggestions({ result }: { result: ChangeInterpretationResult }) {
  if (result.source === 'fallback' || result.suggestions.length === 0) return null;

  const highConf = result.suggestions.filter((s) => s.confidence >= CONFIDENCE_THRESHOLDS.HIGH);
  const medConf = result.suggestions.filter(
    (s) => s.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && s.confidence < CONFIDENCE_THRESHOLDS.HIGH,
  );

  const visible = [...highConf, ...medConf].slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-4">
      <p className="text-xs text-white/35 font-inter-tight mb-2.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/60" />
        Sugerencias de IA — no vinculantes
      </p>
      <div className="space-y-2">
        {visible.map((s, i) => (
          <div
            key={`${s.catalogCode}-${i}`}
            className="flex items-start gap-2"
          >
            <span
              className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                s.confidence >= CONFIDENCE_THRESHOLDS.HIGH
                  ? 'bg-emerald-400/60'
                  : 'bg-amber-400/60'
              }`}
            />
            <p className="text-xs text-white/55 font-inter-tight leading-relaxed">
              {s.clientSummary}
              {s.needsClarification && s.clarificationQuestion && (
                <span className="block mt-0.5 text-white/30 italic">
                  {s.clarificationQuestion}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      {result.overallSummary && (
        <p className="mt-2.5 pt-2.5 border-t border-white/[0.06] text-xs text-white/30 font-inter-tight italic">
          {result.overallSummary}
        </p>
      )}
    </div>
  );
}

export function ChangeRequestComposer({
  projectId,
  projectPlan,
  productionUrl,
}: ChangeRequestComposerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const [preview, setPreview] = useState<ChangeInterpretationResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePreview = useCallback(
    (text: string) => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (text.length < MIN_CHARS) {
        setPreview(null);
        return;
      }
      setLoadingPreview(true);
      previewTimerRef.current = setTimeout(async () => {
        try {
          const result = await previewChangeRequest(text, projectPlan, productionUrl);
          setPreview(result);
        } catch {
          setPreview(null);
        } finally {
          setLoadingPreview(false);
        }
      }, 800);
    },
    [projectPlan, productionUrl],
  );

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return;
    setDescription(val);
    setError(null);
    schedulePreview(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(`Describe tu solicitud con al menos ${MIN_CHARS} caracteres.`);
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError('La descripción no puede superar 2000 caracteres.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitChangeRequest({
        projectId,
        description: trimmed,
        title: title.trim() || undefined,
      });
      if (result.ok && result.ticketNumber) {
        setSubmitted(true);
        setSubmittedTicket(result.ticketNumber);
      } else {
        setError(result.error ?? 'Ocurrió un error. Intenta de nuevo.');
      }
    });
  };

  if (submitted && submittedTicket) {
    return (
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-6 mb-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-3">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-emerald-400">
            <path d="M4 10.5l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-sm font-clash-grotesk font-semibold text-white/85 mb-1">
          Solicitud enviada
        </h3>
        <p className="text-xs text-white/40 font-inter-tight mb-4">
          {submittedTicket} · Te enviaremos una cotización en menos de 24 h.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/cambios-y-mejoras/${submittedTicket}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-sm text-white/75 font-inter-tight hover:bg-white/[0.10] hover:text-white/90 transition-all duration-150"
        >
          Ver solicitud
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  const canSubmit = description.trim().length >= MIN_CHARS && !isPending;

  return (
    <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-5 mb-6">
      <h3 className="text-sm font-clash-grotesk font-semibold text-white/85 mb-1">
        Nueva solicitud
      </h3>
      <p className="text-xs text-white/40 font-inter-tight leading-relaxed mb-4">
        Describe lo que necesitas. Xavier te enviará una cotización en menos de 24 h.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Título opcional */}
        <div>
          <input
            type="text"
            placeholder="Título breve (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            maxLength={120}
            className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 font-inter-tight placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Descripción */}
        <div className="relative">
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Describe qué quieres cambiar o agregar en tu sitio…"
            rows={4}
            className="w-full resize-none bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 font-inter-tight placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
          />
          <div className="flex items-center justify-between mt-1 px-0.5">
            {description.length > 0 && description.length < MIN_CHARS ? (
              <span className="text-xs text-white/30 font-inter-tight">
                Mínimo {MIN_CHARS} caracteres
              </span>
            ) : (
              <span />
            )}
            <CharCount count={description.length} />
          </div>
        </div>

        {/* Preview IA */}
        {loadingPreview && (
          <p className="text-xs text-white/25 font-inter-tight flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/40 animate-pulse" />
            Analizando solicitud…
          </p>
        )}
        {preview && !loadingPreview && <AiSuggestions result={preview} />}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 font-inter-tight">{error}</p>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/[0.12] text-sm text-white/80 font-inter-tight hover:bg-white/[0.12] hover:text-white/95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
                Enviando…
              </>
            ) : (
              <>
                Enviar solicitud
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
