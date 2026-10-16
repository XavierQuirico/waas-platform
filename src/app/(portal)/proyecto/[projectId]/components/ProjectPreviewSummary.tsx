import Link from 'next/link';
import type { ProjectStatus } from '@/lib/projects/state-machine';

interface ProjectPreviewSummaryProps {
  projectId: string;
  status: ProjectStatus;
  stagingUrl: string | null;
  productionUrl: string | null;
}

export function ProjectPreviewSummary({
  projectId,
  status,
  stagingUrl,
  productionUrl,
}: ProjectPreviewSummaryProps) {
  const isStagingReview = status === 'STAGING_REVIEW';
  const isRevisionsInProgress = status === 'REVISIONS';
  const isRevisionsDone = status === 'REVISIONS_DONE';
  const isLive = status === 'LIVE';
  const isClosed = status === 'CLOSED';
  const hasStarted =
    isStagingReview ||
    isRevisionsInProgress ||
    isRevisionsDone ||
    isLive ||
    isClosed;

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
      aria-label="Preview y revisiones"
    >
      <h2
        className="mb-1 text-sm font-semibold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
      >
        Preview / Revisiones
      </h2>

      {!hasStarted && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(249,249,249,0.2)' }}>
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
          text="El preview aparecerá aquí cuando los materiales estén listos y la producción comience."
        />
      )}

      {isStagingReview && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'rgba(249,249,249,0.6)', lineHeight: 1.6 }}>
            Hay una versión de tu sitio lista para revisar. Ábrela y cuéntanos qué piensas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {stagingUrl && (
              <a
                href={stagingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(107,159,255,0.12)', color: '#6B9FFF' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Abrir preview
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" x2="21" y1="14" y2="3" />
                </svg>
              </a>
            )}
            <Link
              href={`/proyecto/${projectId}/staging`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(249,249,249,0.8)' }}
            >
              Revisar y dar feedback
            </Link>
          </div>
        </div>
      )}

      {isRevisionsInProgress && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'rgba(249,249,249,0.6)', lineHeight: 1.6 }}>
            Xavier está aplicando los cambios que solicitaste. Te avisaremos cuando haya
            una nueva versión del preview lista para revisar.
          </p>
          <Link
            href={`/proyecto/${projectId}/staging`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(249,249,249,0.8)' }}
          >
            Ver estado de revisiones
          </Link>
        </div>
      )}

      {isRevisionsDone && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'rgba(249,249,249,0.6)', lineHeight: 1.6 }}>
            Las revisiones están listas. Xavier preparará el siguiente paso: una nueva
            versión del preview o la publicación de tu sitio.
          </p>
          <Link
            href={`/proyecto/${projectId}/staging`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(249,249,249,0.8)' }}
          >
            Ver estado de revisiones
          </Link>
        </div>
      )}

      {isLive && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
            style={{ background: 'rgba(93,214,156,0.08)', color: '#5DD69C' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Tu sitio está publicado
          </div>
          {productionUrl && (
            <a
              href={productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(93,214,156,0.1)', color: '#5DD69C' }}
            >
              Ver mi sitio
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" x2="21" y1="14" y2="3" />
              </svg>
            </a>
          )}
        </div>
      )}

      {isClosed && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
          style={{ background: 'rgba(93,214,156,0.08)', color: '#5DD69C' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Proyecto entregado
        </div>
      )}
    </section>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      {icon}
      <p className="text-xs" style={{ color: 'rgba(249,249,249,0.3)', maxWidth: 280 }}>
        {text}
      </p>
    </div>
  );
}
