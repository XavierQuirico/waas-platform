import Link from 'next/link';
import type { AssetProgress } from '@/lib/assets/asset-ui';
import type { AssetPageMode } from '@/lib/assets/asset-ui';

interface ProjectMaterialsSummaryProps {
  projectId: string;
  progress: AssetProgress;
  mode: AssetPageMode;
}

function getOverallStatus(progress: AssetProgress, mode: AssetPageMode): { label: string; color: string } {
  if (mode === 'review') return { label: 'En revisión', color: '#D4B8FF' };
  if (mode === 'locked' && progress.requiredComplete === progress.requiredTotal) {
    return { label: 'Completado', color: '#5DD69C' };
  }
  if (progress.requiredComplete === 0) return { label: 'Pendientes', color: 'rgba(249,249,249,0.3)' };
  if (progress.requiredComplete < progress.requiredTotal) {
    return { label: 'Incompletos', color: '#FF8C00' };
  }
  return { label: 'Listo para enviar', color: '#5DD69C' };
}

export function ProjectMaterialsSummary({ projectId, progress, mode }: ProjectMaterialsSummaryProps) {
  const { label: statusLabel, color: statusColor } = getOverallStatus(progress, mode);
  const ctaHref = `/proyecto/${projectId}/assets`;
  const ctaLabel = mode === 'editable' ? 'Gestionar materiales' : 'Ver materiales';

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
      aria-label="Materiales del proyecto"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Paquete de materiales
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {progress.requiredComplete} de {progress.requiredTotal} requeridos listos para que
            Xavier prepare tu sitio.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
          style={{
            color: statusColor,
            borderColor: statusColor,
            background: `${statusColor}14`,
            fontSize: 9,
            letterSpacing: '0.06em',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Progress rows */}
      <div className="mb-4 space-y-2.5">
        <ProgressRow
          label="Requeridos"
          complete={progress.requiredComplete}
          total={progress.requiredTotal}
          accent={progress.requiredComplete >= progress.requiredTotal ? '#5DD69C' : '#FF8C00'}
        />
        {progress.optionalTotal > 0 && (
          <ProgressRow
            label="Opcionales"
            complete={progress.optionalComplete}
            total={progress.optionalTotal}
            accent="#6B9FFF"
            muted
          />
        )}
      </div>

      {mode === 'editable' && progress.requiredComplete < progress.requiredTotal && (
        <p className="mb-3 text-xs" style={{ color: '#FFB347' }}>
          Faltan {progress.requiredTotal - progress.requiredComplete} requeridos por subir.
        </p>
      )}

      {mode === 'review' && (
        <p
          className="mb-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(212,184,255,0.08)', color: '#D4B8FF' }}
        >
          Materiales enviados. Xavier los está revisando.
        </p>
      )}

      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{
          background: mode === 'editable' ? '#FF8C00' : 'rgba(255,255,255,0.08)',
          color: mode === 'editable' ? '#121212' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {ctaLabel}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </section>
  );
}

function ProgressRow({
  label,
  complete,
  total,
  accent,
  muted = false,
}: {
  label: string;
  complete: number;
  total: number;
  accent: string;
  muted?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: muted ? 'rgba(249,249,249,0.35)' : 'rgba(249,249,249,0.6)' }}
        >
          {label}
        </span>
        <span
          className="text-xs tabular-nums"
          style={{ color: muted ? 'rgba(249,249,249,0.3)' : 'rgba(249,249,249,0.5)' }}
        >
          {complete}/{total}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${complete} de ${total}`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}
