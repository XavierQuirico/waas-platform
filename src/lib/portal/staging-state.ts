import type { ProjectStatus } from '@/lib/projects/state-machine';

export type PortalStagingVisualState =
  | 'ready'
  | 'approved'
  | 'feedback_sent'
  | 'revisions_in_progress'
  | 'revisions_done'
  | 'live'
  | 'closed'
  | 'unavailable';

export interface StagingFeedbackSummary {
  count: number;
  lastSubmittedAt: Date | null;
  lastAllApproved: boolean | null;
  lastHasChanges: boolean;
}

export function derivePortalStagingVisualState(input: {
  status: ProjectStatus;
  feedback: StagingFeedbackSummary;
}): PortalStagingVisualState {
  const { status, feedback } = input;

  switch (status) {
    case 'LIVE':
      return 'live';
    case 'CLOSED':
      return 'closed';
    case 'REVISIONS':
      return 'revisions_in_progress';
    case 'REVISIONS_DONE':
      return 'revisions_done';
    case 'STAGING_REVIEW':
      if (feedback.lastAllApproved === true) return 'approved';
      if (feedback.lastHasChanges) return 'feedback_sent';
      return 'ready';
    default:
      return 'unavailable';
  }
}

export function getPortalStagingCopy(state: PortalStagingVisualState): {
  badge: string;
  title: string;
  description: string;
} {
  switch (state) {
    case 'ready':
      return {
        badge: 'Preview listo',
        title: 'Revisa tu preview',
        description:
          'Abre el preview en una pestaña nueva, revisa el sitio completo y envía una ronda clara de feedback.',
      };
    case 'approved':
      return {
        badge: 'Preview aprobado',
        title: 'Aprobación enviada',
        description: 'Xavier recibió tu aprobación y preparará la publicación del sitio.',
      };
    case 'feedback_sent':
      return {
        badge: 'Feedback enviado',
        title: 'Tus cambios fueron enviados',
        description:
          'Xavier revisará tus comentarios y te avisará cuando el nuevo preview esté listo.',
      };
    case 'revisions_in_progress':
      return {
        badge: 'En revisiones',
        title: 'Xavier está aplicando tus cambios',
        description:
          'El formulario queda bloqueado mientras se prepara una nueva versión del preview.',
      };
    case 'revisions_done':
      return {
        badge: 'Revisiones listas',
        title: 'Revisiones completadas',
        description: 'Xavier preparará el siguiente paso: nuevo preview o publicación.',
      };
    case 'live':
      return {
        badge: 'Publicado',
        title: 'Tu sitio ya está publicado',
        description: 'Puedes revisar el sitio activo desde Mi sitio.',
      };
    case 'closed':
      return {
        badge: 'Entregado',
        title: 'Proyecto entregado',
        description: 'Este proyecto ya fue entregado.',
      };
    case 'unavailable':
      return {
        badge: 'No disponible',
        title: 'Preview no disponible',
        description:
          'Esta pantalla estará disponible cuando tu proyecto llegue a revisión de preview.',
      };
  }
}
