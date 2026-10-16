import { requireClientProject } from '@/lib/portal/context';
import { db } from '@/db';
import { projects, stagingFeedback } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { isPortalProjectNotFoundError } from '@/lib/portal/errors';
import PortalNotFound from '../not-found';
import {
  derivePortalStagingVisualState,
  type StagingFeedbackSummary,
} from '@/lib/portal/staging-state';
import { StagingPreviewCard } from './components/StagingPreviewCard';
import { StagingReviewStatus } from './components/StagingReviewStatus';
import { StagingFeedbackHistory } from './components/StagingFeedbackHistory';
import { StagingFeedbackForm } from './components/StagingFeedbackForm';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StagingReviewPage({ params }: PageProps) {
  const { projectId } = await params;

  let ctx: Awaited<ReturnType<typeof requireClientProject>>;
  try {
    ctx = await requireClientProject(projectId);
  } catch (err) {
    if (isPortalProjectNotFoundError(err)) return <PortalNotFound />;
    throw err;
  }

  const { project } = ctx!;

  const [stagingData, feedbackRows] = await Promise.all([
    db
      .select({
        stagingUrl: projects.stagingUrl,
        stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then(([r]) => r ?? null),
    db
      .select({
        id: stagingFeedback.id,
        submittedAt: stagingFeedback.submittedAt,
        allApproved: stagingFeedback.allApproved,
        items: stagingFeedback.items,
      })
      .from(stagingFeedback)
      .where(eq(stagingFeedback.projectId, project.id))
      .orderBy(desc(stagingFeedback.submittedAt)),
  ]);

  const lastFeedback = feedbackRows[0] ?? null;

  const feedbackSummary: StagingFeedbackSummary = {
    count: feedbackRows.length,
    lastSubmittedAt: lastFeedback?.submittedAt ?? null,
    lastAllApproved: lastFeedback?.allApproved ?? null,
    lastHasChanges:
      lastFeedback !== null &&
      lastFeedback.allApproved !== true &&
      Array.isArray(lastFeedback.items) &&
      lastFeedback.items.length > 0,
  };

  const visualState = derivePortalStagingVisualState({
    status: project.status,
    feedback: feedbackSummary,
  });

  const revisionNumber = feedbackRows.length + 1;
  const canSubmitFeedback = project.status === 'STAGING_REVIEW' && visualState === 'ready';

  const disabledReason = (() => {
    switch (visualState) {
      case 'revisions_in_progress':
        return 'Xavier está aplicando tus cambios. El formulario estará disponible cuando haya un nuevo preview.';
      case 'revisions_done':
        return 'Las revisiones están listas. Xavier preparará el siguiente paso.';
      case 'feedback_sent':
        return 'Ya enviaste feedback para esta ronda. Xavier revisará tus comentarios.';
      default:
        return undefined;
    }
  })();

  const historyItems = feedbackRows.map((row) => ({
    id: row.id,
    submittedAt: row.submittedAt,
    allApproved: row.allApproved ?? null,
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
  }));

  const isFormState =
    project.status === 'STAGING_REVIEW' ||
    project.status === 'REVISIONS' ||
    project.status === 'REVISIONS_DONE';

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      {/* Back link */}
      <Link
        href={`/proyecto/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70"
      >
        ← Volver al proyecto
      </Link>

      {/* Status header */}
      <StagingReviewStatus
        state={visualState}
        deadline={stagingData?.stagingReviewDeadlineAt ?? null}
        feedbackCount={feedbackSummary.count}
        lastSubmittedAt={feedbackSummary.lastSubmittedAt}
      />

      {/* Preview card */}
      <StagingPreviewCard stagingUrl={stagingData?.stagingUrl ?? null} />

      {/* Form / state section */}
      {isFormState ? (
        <StagingFeedbackForm
          projectId={project.id}
          revisionNumber={revisionNumber}
          canSubmit={canSubmitFeedback}
          disabledReason={disabledReason}
          alreadyApproved={visualState === 'approved'}
        />
      ) : project.status === 'LIVE' ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-5 text-center space-y-2">
          <p className="text-sm font-semibold text-green-400">Tu sitio ya está publicado.</p>
          <Link
            href="/mi-sitio"
            className="inline-block text-sm text-white/50 transition-colors hover:text-white/70"
          >
            Ir a Mi sitio →
          </Link>
        </div>
      ) : project.status === 'CLOSED' ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center space-y-2">
          <p className="text-sm font-semibold text-white/70">Proyecto entregado.</p>
          <Link
            href={`/proyecto/${projectId}`}
            className="inline-block text-sm text-white/40 transition-colors hover:text-white/60"
          >
            Ver proyecto →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center space-y-2">
          <p className="text-sm text-white/50">
            Esta pantalla no está disponible en el estado actual del proyecto.
          </p>
          <Link
            href={`/proyecto/${projectId}`}
            className="inline-block text-sm text-white/50 transition-colors hover:text-white/70"
          >
            Volver al proyecto →
          </Link>
        </div>
      )}

      {/* Feedback history */}
      <StagingFeedbackHistory items={historyItems} />
    </div>
  );
}
