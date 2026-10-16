import type { ProjectStatus } from '@/lib/projects/state-machine';
import type { ProjectType } from './project-type';
import { toExternalUrl } from './url';
import {
  getPortalProjectDisplayName,
  type PortalProjectDisplayInput,
} from './project-display';
import { whatsappUrl } from '@/lib/config/contact';

export type PortalDashboardVisualState =
  | 'limited'
  | 'materials'
  | 'review'
  | 'building'
  | 'preview'
  | 'active';

export interface StepItem {
  label: string;
}

export interface PortalStatusConfig {
  badgeLabel: string;
  badgeType: 'neutral' | 'amber' | 'violet' | 'blue' | 'green' | 'red';
  title: string;
  desc: string;
  cta1: { label: string; href: string; external?: boolean } | null;
  cta2: { label: string; href: string; external?: boolean } | null;
  accentColor: string;
  bgGrad: string;
}

const WA_LINK = whatsappUrl();

export function derivePortalDashboardState(input: {
  status: ProjectStatus;
  projectType: ProjectType;
  hasProject: boolean;
  stagingUrl: string | null;
  productionUrl: string | null;
  liveAt: Date | null;
}): PortalDashboardVisualState {
  const { status, hasProject } = input;

  if (!hasProject) return 'limited';

  switch (status) {
    case 'DRAFT':
    case 'PROPOSAL_SENT':
    case 'REQUIRES_REVIEW':
    case 'PAYMENT_RECEIVED':
    case 'PROPOSAL_EXPIRED':
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'limited';

    case 'AWAITING_ASSETS':
    case 'ASSETS_INCOMPLETE':
      return 'materials';

    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW':
      return 'review';

    case 'PRODUCTION_STARTED':
    case 'REVISIONS':
    case 'REVISIONS_DONE':
      return 'building';

    case 'STAGING_REVIEW':
      return 'preview';

    case 'LIVE':
    case 'CLOSED':
      return 'active';

    default:
      return 'limited';
  }
}

export function getPortalDashboardStatusConfig(input: {
  visualState: PortalDashboardVisualState;
  status: ProjectStatus;
  projectType: ProjectType;
  projectId: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
}): PortalStatusConfig {
  const { visualState, status, projectType, projectId, stagingUrl, productionUrl } = input;
  const projectHref = projectId ? `/proyecto/${projectId}` : '/dashboard';

  switch (visualState) {
    case 'limited': {
      if (status === 'SUSPENDED') {
        return {
          badgeLabel: 'Acceso limitado',
          badgeType: 'red',
          title: 'Tu cuenta necesita atención',
          desc: 'Hay un problema relacionado con tu suscripción. Puedes revisar facturación o escribirle a Xavier.',
          cta1: { label: 'Ir a Facturación', href: '/facturacion' },
          cta2: { label: 'Escribir por WhatsApp', href: WA_LINK, external: true },
          accentColor: '#F87171',
          bgGrad: 'rgba(248,113,113,0.07)',
        };
      }
      return {
        badgeLabel: 'Portal en activación',
        badgeType: 'neutral',
        title: 'Solicitud recibida',
        desc: 'Xavier está revisando los detalles para preparar tu propuesta y activar tu portal completo. No tienes que hacer nada por ahora.',
        cta1: { label: 'Contactar a Xavier', href: WA_LINK, external: true },
        cta2: null,
        accentColor: '#FF8C00',
        bgGrad: 'rgba(255,140,0,0.08)',
      };
    }

    case 'materials': {
      const isIncomplete = status === 'ASSETS_INCOMPLETE';
      return {
        badgeLabel: 'Materiales pendientes',
        badgeType: 'amber',
        title: isIncomplete
          ? 'Necesitamos ajustar algunos materiales'
          : 'Necesitamos tus materiales',
        desc: isIncomplete
          ? 'Xavier revisó tus materiales y hay algunos puntos que debes completar o corregir.'
          : 'Para comenzar tu sitio, necesitamos información de tu negocio: logo, fotos, textos y datos de contacto.',
        cta1: { label: 'Subir materiales', href: '/onboarding/assets' },
        cta2: { label: 'Contactar a Xavier', href: WA_LINK, external: true },
        accentColor: '#FF8C00',
        bgGrad: 'rgba(255,140,0,0.08)',
      };
    }

    case 'review':
      return {
        badgeLabel: 'En revisión',
        badgeType: 'violet',
        title: 'Xavier está revisando lo que enviaste',
        desc: 'Revisaremos tus materiales y te avisaremos si necesitamos algo más. No tienes que hacer nada por ahora.',
        cta1: { label: 'Ver estado del proyecto', href: projectHref },
        cta2: { label: 'Contactar a Xavier', href: WA_LINK, external: true },
        accentColor: '#D4B8FF',
        bgGrad: 'rgba(212,184,255,0.07)',
      };

    case 'building': {
      let title = 'Tu sitio está en construcción';
      let desc = 'Xavier está construyendo tu sitio. Te avisaremos cuando haya una versión para revisar.';
      if (status === 'REVISIONS') {
        title = 'Estamos aplicando tus cambios';
        desc = 'Xavier está trabajando en los ajustes que solicitaste.';
      } else if (status === 'REVISIONS_DONE') {
        title = 'Revisiones listas';
        desc = 'Los cambios fueron aplicados. Xavier está preparando la siguiente revisión o publicación.';
      }
      return {
        badgeLabel: 'En construcción',
        badgeType: 'violet',
        title,
        desc,
        cta1: { label: 'Ver progreso', href: projectHref },
        cta2: { label: 'Contactar a Xavier', href: WA_LINK, external: true },
        accentColor: '#D4B8FF',
        bgGrad: 'rgba(212,184,255,0.07)',
      };
    }

    case 'preview': {
      const normalizedStagingUrl = toExternalUrl(stagingUrl);
      const previewCta1 = normalizedStagingUrl
        ? { label: 'Revisar preview', href: normalizedStagingUrl, external: true as const }
        : { label: 'Ver estado del preview', href: projectId ? `/proyecto/${projectId}/staging` : '/dashboard' };
      return {
        badgeLabel: 'Preview listo',
        badgeType: 'blue',
        title: 'Tu preview está listo para revisar',
        desc: 'Hay una primera versión de tu sitio disponible. Revísala y cuéntanos qué piensas antes de publicar.',
        cta1: previewCta1,
        cta2: projectId ? { label: 'Enviar feedback', href: `/proyecto/${projectId}/staging` } : null,
        accentColor: '#6B9FFF',
        bgGrad: 'rgba(107,159,255,0.07)',
      };
    }

    case 'active': {
      if (status === 'CLOSED') {
        const cta2Closed =
          projectType === 'SUBSCRIPTION'
            ? { label: 'Cambios y mejoras', href: '/cambios-y-mejoras' }
            : projectType === 'LEGACY'
              ? { label: 'Mantenimiento', href: '/mantenimiento' }
              : { label: 'Soporte', href: '/soporte' };
        return {
          badgeLabel: 'Entregado',
          badgeType: 'green',
          title: 'Proyecto entregado',
          desc: 'Este proyecto fue entregado correctamente. Puedes revisar los detalles o escribirle a Xavier si necesitas algo adicional.',
          cta1: { label: 'Ver mi sitio', href: '/mi-sitio' },
          cta2: cta2Closed,
          accentColor: '#5DD69C',
          bgGrad: 'rgba(93,214,156,0.07)',
        };
      }
      const liveDesc = productionUrl
        ? 'Tu sitio está publicado y funcionando correctamente.'
        : 'Tu sitio está publicado. Xavier puede ayudarte si necesitas revisar la URL final.';
      const cta2Live =
        projectType === 'SUBSCRIPTION'
          ? { label: 'Pedir un cambio', href: '/cambios-y-mejoras' }
          : projectType === 'LEGACY'
            ? { label: 'Mantenimiento', href: '/mantenimiento' }
            : { label: 'Soporte', href: '/soporte' };
      return {
        badgeLabel: 'Publicado',
        badgeType: 'green',
        title: 'Tu sitio está activo',
        desc: liveDesc,
        cta1: { label: 'Ver mi sitio', href: '/mi-sitio' },
        cta2: cta2Live,
        accentColor: '#5DD69C',
        bgGrad: 'rgba(93,214,156,0.07)',
      };
    }
  }
}

const STEPS_SUBSCRIPTION: StepItem[] = [
  { label: 'Solicitud enviada' },
  { label: 'Materiales enviados' },
  { label: 'Xavier construye tu sitio' },
  { label: 'Preview y revisiones' },
  { label: 'Sitio publicado' },
];

const STEPS_LEGACY: StepItem[] = [
  { label: 'Cotización acordada' },
  { label: 'Acuerdo confirmado' },
  { label: 'Producción' },
  { label: 'Preview y revisiones' },
  { label: 'Entrega' },
];

const STEPS_PORTFOLIO: StepItem[] = [
  { label: 'Proyecto registrado' },
  { label: 'Materiales listos' },
  { label: 'Producción' },
  { label: 'Preview y ajustes' },
  { label: 'Publicado / entregado' },
];

export function getPortalDashboardSteps(projectType: ProjectType): StepItem[] {
  if (projectType === 'LEGACY') return STEPS_LEGACY;
  if (projectType === 'PORTFOLIO') return STEPS_PORTFOLIO;
  return STEPS_SUBSCRIPTION;
}

const STEP_FOR_VISUAL: Record<PortalDashboardVisualState, number> = {
  limited: 1,
  materials: 2,
  review: 2,
  building: 3,
  preview: 4,
  active: 5,
};

export function getPortalDashboardCurrentStep(visualState: PortalDashboardVisualState): number {
  return STEP_FOR_VISUAL[visualState];
}

export function getProjectTypeLabel(
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
  portfolioFlag: boolean,
): string {
  if (portfolioFlag) return 'Proyecto portfolio';
  if (plan === 'LEGACY') return 'Proyecto legacy';
  const labels: Record<string, string> = {
    BASIC: 'Plan Basic',
    PRO: 'Plan Pro',
    BUSINESS: 'Plan Business',
  };
  return labels[plan] ?? plan;
}

/**
 * Human-safe project label for the dashboard. Delegates to the shared
 * portal helper — never derives a label from projectId/UUID.
 */
export function getProjectDisplayName(input: PortalProjectDisplayInput): string {
  return getPortalProjectDisplayName(input);
}

// ─── Project overview: phase bar ─────────────────────────────────────────────

export interface ProjectPhaseItem {
  label: string;
}

const OVERVIEW_PHASES_SUBSCRIPTION: ProjectPhaseItem[] = [
  { label: 'Solicitud' },
  { label: 'Materiales' },
  { label: 'Revisión Xavier' },
  { label: 'Producción' },
  { label: 'Preview' },
  { label: 'Revisiones' },
  { label: 'Publicado' },
];

const OVERVIEW_PHASES_LEGACY: ProjectPhaseItem[] = [
  { label: 'Cotización' },
  { label: 'Acuerdo' },
  { label: 'Producción' },
  { label: 'Preview' },
  { label: 'Revisiones' },
  { label: 'Entrega' },
];

const OVERVIEW_PHASES_PORTFOLIO: ProjectPhaseItem[] = [
  { label: 'Preparación' },
  { label: 'Materiales' },
  { label: 'Producción' },
  { label: 'Preview' },
  { label: 'Publicado' },
];

export function getProjectPhases(projectType: ProjectType): ProjectPhaseItem[] {
  if (projectType === 'LEGACY') return OVERVIEW_PHASES_LEGACY;
  if (projectType === 'PORTFOLIO') return OVERVIEW_PHASES_PORTFOLIO;
  return OVERVIEW_PHASES_SUBSCRIPTION;
}

export function getProjectCurrentPhaseIndex(
  status: ProjectStatus,
  projectType: ProjectType,
): number {
  if (projectType === 'SUBSCRIPTION') {
    switch (status) {
      case 'DRAFT':
      case 'PROPOSAL_SENT':
      case 'REQUIRES_REVIEW':
      case 'PAYMENT_RECEIVED':
      case 'PROPOSAL_EXPIRED':
        return 0;
      case 'AWAITING_ASSETS':
      case 'ASSETS_INCOMPLETE':
        return 1;
      case 'ASSETS_SUBMITTED':
      case 'ASSETS_UNDER_REVIEW':
        return 2;
      case 'PRODUCTION_STARTED':
        return 3;
      case 'STAGING_REVIEW':
        return 4;
      case 'REVISIONS':
      case 'REVISIONS_DONE':
        return 5;
      case 'LIVE':
      case 'CLOSED':
        return 6;
      default:
        return 0;
    }
  }
  if (projectType === 'LEGACY') {
    switch (status) {
      case 'DRAFT':
      case 'PROPOSAL_SENT':
      case 'REQUIRES_REVIEW':
      case 'PROPOSAL_EXPIRED':
        return 0;
      case 'PAYMENT_RECEIVED':
      case 'AWAITING_ASSETS':
      case 'ASSETS_INCOMPLETE':
        return 1;
      case 'ASSETS_SUBMITTED':
      case 'ASSETS_UNDER_REVIEW':
      case 'PRODUCTION_STARTED':
        return 2;
      case 'STAGING_REVIEW':
        return 3;
      case 'REVISIONS':
      case 'REVISIONS_DONE':
        return 4;
      case 'LIVE':
      case 'CLOSED':
        return 5;
      default:
        return 0;
    }
  }
  // PORTFOLIO
  switch (status) {
    case 'DRAFT':
    case 'PROPOSAL_SENT':
    case 'REQUIRES_REVIEW':
    case 'PAYMENT_RECEIVED':
    case 'PROPOSAL_EXPIRED':
      return 0;
    case 'AWAITING_ASSETS':
    case 'ASSETS_INCOMPLETE':
      return 1;
    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW':
    case 'PRODUCTION_STARTED':
      return 2;
    case 'STAGING_REVIEW':
    case 'REVISIONS':
    case 'REVISIONS_DONE':
      return 3;
    case 'LIVE':
    case 'CLOSED':
      return 4;
    default:
      return 0;
  }
}

// ─── Project overview: status badge ──────────────────────────────────────────

export type ProjectStatusBadgeType = 'neutral' | 'amber' | 'violet' | 'blue' | 'green' | 'red';

export interface ProjectStatusBadgeConfig {
  label: string;
  type: ProjectStatusBadgeType;
}

export function getProjectStatusBadge(status: ProjectStatus): ProjectStatusBadgeConfig {
  switch (status) {
    case 'DRAFT':
    case 'PROPOSAL_SENT':
    case 'REQUIRES_REVIEW':
    case 'PAYMENT_RECEIVED':
    case 'PROPOSAL_EXPIRED':
      return { label: 'En activación', type: 'neutral' };
    case 'AWAITING_ASSETS':
      return { label: 'Materiales pendientes', type: 'amber' };
    case 'ASSETS_INCOMPLETE':
      return { label: 'Necesita correcciones', type: 'amber' };
    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW':
      return { label: 'En revisión', type: 'violet' };
    case 'PRODUCTION_STARTED':
      return { label: 'En construcción', type: 'violet' };
    case 'STAGING_REVIEW':
      return { label: 'Preview listo', type: 'blue' };
    case 'REVISIONS':
      return { label: 'En revisiones', type: 'blue' };
    case 'REVISIONS_DONE':
      return { label: 'Revisiones listas', type: 'blue' };
    case 'LIVE':
      return { label: 'Publicado', type: 'green' };
    case 'CLOSED':
      return { label: 'Entregado', type: 'green' };
    case 'SUSPENDED':
      return { label: 'Suspendido', type: 'red' };
    case 'CANCELLED':
      return { label: 'Cancelado', type: 'red' };
    default:
      return { label: 'En activación', type: 'neutral' };
  }
}
