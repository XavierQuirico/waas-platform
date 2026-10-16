'use client';

import { useState, useTransition } from 'react';
import { reportClientIncident } from '../actions';
import type { IncidentPageData, ClientIncident, ReportIncidentInput } from '../actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'P1' | 'P2' | 'P3';

const SEVERITY_CONFIG: Record<Severity, { label: string; description: string; colorClass: string; badgeClass: string }> = {
  P1: {
    label: 'Crítico',
    description: 'El sitio no carga o una función esencial dejó de funcionar.',
    colorClass: 'text-red-400',
    badgeClass: 'border-red-500/30 bg-red-500/10 text-red-400',
  },
  P2: {
    label: 'Importante',
    description: 'Algo relevante no funciona bien, pero el sitio sigue disponible.',
    colorClass: 'text-amber-400',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  P3: {
    label: 'Normal',
    description: 'Algo menor necesita revisión, sin bloquear el uso del sitio.',
    colorClass: 'text-blue-400',
    badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
};

const STATUS_CONFIG: Record<ClientIncident['status'], { label: string; badgeClass: string }> = {
  OPEN: { label: 'Abierta', badgeClass: 'border-red-500/20 bg-red-500/10 text-red-400' },
  IN_PROGRESS: { label: 'En progreso', badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
  RESOLVED: { label: 'Resuelta', badgeClass: 'border-green-500/20 bg-green-500/10 text-green-400' },
};

function reportedByLabel(r: ClientIncident['reportedBy']) {
  if (r === 'CLIENT') return 'Reportada por ti';
  if (r === 'SYSTEM') return 'Detectada automáticamente';
  return 'Registrada por soporte';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SiteStatusBanner({
  status,
  productionUrl,
}: {
  status: 'operational' | 'degraded';
  productionUrl: string | null;
}) {
  const isOk = status === 'operational';
  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        isOk ? 'border-green-500/20 bg-green-500/[0.07]' : 'border-amber-500/20 bg-amber-500/[0.07]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
            isOk ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
          }`}
        />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isOk ? 'text-green-400' : 'text-amber-400'}`}>
            {isOk ? 'Sitio operativo' : 'Revisión en curso'}
          </p>
          <p className={`mt-0.5 text-xs ${isOk ? 'text-green-400/50' : 'text-amber-400/50'}`}>
            {isOk
              ? 'No hay incidencias activas en este momento.'
              : 'Estamos revisando una incidencia activa de tu sitio.'}
          </p>
          {productionUrl && (
            <p className="mt-1 truncate text-xs text-white/30">{productionUrl}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityPicker({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {(['P1', 'P2', 'P3'] as Severity[]).map((sev) => {
        const cfg = SEVERITY_CONFIG[sev];
        const active = value === sev;
        return (
          <button
            key={sev}
            type="button"
            onClick={() => onChange(sev)}
            className={`flex-1 rounded-lg border p-3 text-left transition-colors duration-150 ${
              active
                ? `${cfg.badgeClass} border-current/30`
                : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <p className={`text-xs font-semibold ${active ? cfg.colorClass : 'text-white/60'}`}>
              {cfg.label}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-white/40">{cfg.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function IncidentForm({
  projectId,
  onSuccess,
  onCancel,
}: {
  projectId: string;
  onSuccess: (incident: ClientIncident) => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('P3');
  const [description, setDescription] = useState('');
  const [affectedUrl, setAffectedUrl] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanTitle = title.trim();
    if (cleanTitle.length < 5) {
      setError('El título debe tener al menos 5 caracteres.');
      return;
    }

    const input: ReportIncidentInput = {
      projectId,
      title: cleanTitle,
      severity,
      description: description.trim() || undefined,
      affectedUrl: affectedUrl.trim() || undefined,
      evidenceUrl: evidenceUrl.trim() || undefined,
    };

    startTransition(async () => {
      try {
        const result = await reportClientIncident(input);
        if (result.ok) {
          const now = new Date().toISOString();
          onSuccess({
            id: result.incidentId,
            title: cleanTitle,
            description: input.description ?? null,
            affectedUrl: input.affectedUrl ?? null,
            evidenceUrl: input.evidenceUrl ?? null,
            status: 'OPEN',
            severity,
            reportedBy: 'CLIENT',
            resolvedAt: null,
            resolvedNote: null,
            createdAt: now,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al enviar la incidencia. Intenta de nuevo.');
      }
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Reportar incidencia</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Cerrar formulario"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="mb-4 text-xs text-white/30">
        Usa incidencias para errores o problemas técnicos. Si quieres pedir una mejora o nueva
        funcionalidad, ve a{' '}
        <a href={`/proyecto/${projectId}/solicitudes`} className="underline underline-offset-2 hover:text-white/60 transition-colors">
          Solicitudes
        </a>
        .
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Título del problema <span className="text-white/30">(requerido)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: El formulario de contacto no envía"
            maxLength={200}
            required
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <p className="mt-1 text-right text-xs text-white/20">{title.length}/200</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Severidad</label>
          <SeverityPicker value={severity} onChange={setSeverity} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            URL afectada <span className="text-white/20">(opcional)</span>
          </label>
          <input
            type="text"
            value={affectedUrl}
            onChange={(e) => setAffectedUrl(e.target.value)}
            placeholder="https://misitio.com/contacto"
            maxLength={500}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Descripción <span className="text-white/20">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el problema: qué ocurre, desde cuándo, pasos para reproducirlo..."
            maxLength={2000}
            rows={3}
            className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <p className="mt-1 text-right text-xs text-white/20">{description.length}/2000</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Evidencia <span className="text-white/20">(opcional — screenshot, Loom, Drive, etc.)</span>
          </label>
          <input
            type="text"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://drive.google.com/... o https://loom.com/..."
            maxLength={500}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending || title.trim().length < 5}
            className="rounded-md bg-[#d5ff02] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? 'Enviando...' : 'Enviar incidencia'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/[0.08] px-4 py-2 text-sm text-white/50 hover:border-white/20 hover:text-white/70 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function SuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between rounded-lg border border-green-500/20 bg-green-500/[0.07] p-4">
      <p className="text-sm text-green-400">
        Incidencia enviada. Revisaremos el caso y te avisaremos sobre cualquier actualización.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-4 flex-shrink-0 text-green-400/50 hover:text-green-400 transition-colors"
        aria-label="Cerrar"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function IncidentRow({ incident }: { incident: ClientIncident }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[incident.status];
  const sevCfg = SEVERITY_CONFIG[incident.severity];

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Severity badge */}
        <span
          className={`mt-0.5 flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sevCfg.badgeClass}`}
        >
          {incident.severity}
        </span>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white/80 break-words">{incident.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/30">
            <span>{formatDate(incident.createdAt)}</span>
            <span>{reportedByLabel(incident.reportedBy)}</span>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusCfg.badgeClass}`}
        >
          {statusCfg.label}
        </span>

        {/* Chevron */}
        <svg
          className={`mt-0.5 flex-shrink-0 text-white/20 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          {incident.description && (
            <p className="text-xs leading-relaxed text-white/50">{incident.description}</p>
          )}

          {(incident.affectedUrl || incident.evidenceUrl) && (
            <div className="flex flex-wrap gap-2">
              {incident.affectedUrl && (
                <a
                  href={incident.affectedUrl.startsWith('/') ? incident.affectedUrl : incident.affectedUrl}
                  target={incident.affectedUrl.startsWith('/') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex max-w-xs items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-blue-400 hover:border-white/20 transition-colors truncate"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <span className="truncate">URL afectada</span>
                </a>
              )}
              {incident.evidenceUrl && (
                <a
                  href={incident.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-xs items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-blue-400 hover:border-white/20 transition-colors truncate"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="truncate">Ver evidencia</span>
                </a>
              )}
            </div>
          )}

          {incident.status === 'RESOLVED' && incident.resolvedNote && (
            <div className="rounded-md border border-green-500/20 bg-green-500/[0.06] p-3 text-xs text-green-400/80">
              <span className="font-semibold">Resolución: </span>
              {incident.resolvedNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onReport }: { onReport: () => void }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-white/30">
        No hay incidencias registradas. Si notas algo raro en tu sitio, puedes reportarlo aquí.
      </p>
      <button
        type="button"
        onClick={onReport}
        className="mt-4 rounded-md border border-white/[0.08] px-4 py-2 text-sm text-white/50 hover:border-white/20 hover:text-white/70 transition-colors"
      >
        Reportar incidencia
      </button>
    </div>
  );
}

function BlockedState({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center">
      <p className="text-sm text-white/40">{reason}</p>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function IncidenciasPageClient({
  projectId,
  initialData,
}: {
  projectId: string;
  initialData: IncidentPageData;
}) {
  const [data, setData] = useState<IncidentPageData>(initialData);
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  function handleSuccess(newIncident: ClientIncident) {
    setShowForm(false);
    setShowSuccess(true);
    setData((prev) => ({
      ...prev,
      siteStatus: 'degraded',
      incidents: [newIncident, ...prev.incidents],
    }));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Incidencias</h1>
          <p className="mt-1 text-sm text-white/40">
            Reporta problemas técnicos de tu sitio y revisa su seguimiento.
          </p>
        </div>
        {data.canReport && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md bg-white/[0.06] border border-white/[0.08] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.09] hover:border-white/20 transition-colors"
          >
            Reportar incidencia
          </button>
        )}
      </div>

      {/* Site status banner */}
      <SiteStatusBanner
        status={data.siteStatus}
        productionUrl={data.productionUrl}
      />

      {/* Success banner */}
      {showSuccess && (
        <SuccessBanner onDismiss={() => setShowSuccess(false)} />
      )}

      {/* Blocked state */}
      {!data.canReport && data.blockedReason && (
        <BlockedState reason={data.blockedReason} />
      )}

      {/* Report form */}
      {data.canReport && showForm && (
        <IncidentForm
          projectId={projectId}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Incident list */}
      {data.canReport && !showForm && (
        <>
          {data.incidents.length === 0 ? (
            <EmptyState onReport={() => setShowForm(true)} />
          ) : (
            <div className="space-y-2">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">
                Historial
              </h2>
              {data.incidents.map((inc) => (
                <IncidentRow key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
