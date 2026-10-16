// ============================================================
// State Machine — Proyectos WaaS
// 17 estados (16 regulares + CLOSED terminal para LEGACY)
// ============================================================

export type ProjectStatus =
  | 'DRAFT'
  | 'PROPOSAL_SENT'
  | 'REQUIRES_REVIEW'
  | 'PAYMENT_RECEIVED'
  | 'AWAITING_ASSETS'
  | 'ASSETS_SUBMITTED'
  | 'ASSETS_UNDER_REVIEW'
  | 'ASSETS_INCOMPLETE'
  | 'PRODUCTION_STARTED'
  | 'STAGING_REVIEW'
  | 'REVISIONS'
  | 'REVISIONS_DONE'
  | 'LIVE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'PROPOSAL_EXPIRED'
  | 'CLOSED'; // Estado 17 — terminal para proyectos LEGACY (entregado y cerrado)

// Transiciones permitidas — cualquier transición no listada aquí es inválida
const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT:                ['PROPOSAL_SENT', 'REQUIRES_REVIEW'],
  PROPOSAL_SENT:        ['PAYMENT_RECEIVED', 'PROPOSAL_EXPIRED'],
  REQUIRES_REVIEW:      ['PROPOSAL_SENT'],   // El admin crea propuesta custom
  PROPOSAL_EXPIRED:     ['PROPOSAL_SENT'],   // El admin puede re-enviar
  PAYMENT_RECEIVED:     ['AWAITING_ASSETS'],
  AWAITING_ASSETS:      ['ASSETS_SUBMITTED'],
  ASSETS_SUBMITTED:     ['ASSETS_UNDER_REVIEW'],
  ASSETS_UNDER_REVIEW:  ['ASSETS_INCOMPLETE', 'PRODUCTION_STARTED'],
  ASSETS_INCOMPLETE:    ['ASSETS_SUBMITTED'], // cliente re-sube y re-envía
  PRODUCTION_STARTED:   ['STAGING_REVIEW'],
  STAGING_REVIEW:       ['REVISIONS', 'LIVE'],
  REVISIONS:            ['STAGING_REVIEW', 'LIVE', 'REVISIONS_DONE'],
  REVISIONS_DONE:       ['LIVE', 'CLOSED'],  // LEGACY llega a CLOSED aquí
  LIVE:                 ['SUSPENDED', 'CANCELLED'],
  SUSPENDED:            ['LIVE', 'CANCELLED'],
  CANCELLED:            [],
  CLOSED:               [], // Terminal — LEGACY entregado y cerrado exitosamente
};

/**
 * Global override: cualquier proyecto puede cancelarse desde cualquier estado activo.
 * Se aplica además de las transiciones regulares.
 */
const CANCELLABLE_STATES: ProjectStatus[] = [
  'DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED',
  'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE', 'SUSPENDED',
];

/**
 * Verifica si una transición de estado es válida.
 * Incluye la regla global de cancelación.
 */
export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (to === 'CANCELLED' && CANCELLABLE_STATES.includes(from)) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Retorna los estados a los que se puede transicionar desde un estado dado.
 * Incluye CANCELLED si el estado es cancelable.
 */
export function getAllowedTransitions(from: ProjectStatus): ProjectStatus[] {
  const transitions = [...(ALLOWED_TRANSITIONS[from] ?? [])];
  if (CANCELLABLE_STATES.includes(from) && !transitions.includes('CANCELLED')) {
    transitions.push('CANCELLED');
  }
  return transitions;
}

// ─── Etiquetas legibles ───────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT:                'Borrador',
  PROPOSAL_SENT:        'Propuesta enviada',
  REQUIRES_REVIEW:      'Requiere revisión (LEGACY)',
  PROPOSAL_EXPIRED:     'Propuesta expirada',
  PAYMENT_RECEIVED:     'Pago recibido',
  AWAITING_ASSETS:      'Esperando materiales',
  ASSETS_SUBMITTED:     'Materiales enviados',
  ASSETS_UNDER_REVIEW:  'Materiales en revisión',
  ASSETS_INCOMPLETE:    'Materiales incompletos',
  PRODUCTION_STARTED:   'En producción',
  STAGING_REVIEW:       'Revisión de staging',
  REVISIONS:            'En revisiones',
  REVISIONS_DONE:       'Revisiones completadas',
  LIVE:                 'En vivo',
  SUSPENDED:            'Suspendido',
  CANCELLED:            'Cancelado',
  CLOSED:               'Entregado',
};

// ─── Portfolio State Machine (separado — sin estados de pago) ─────────────

export type PortfolioStatus =
  | 'DRAFT'
  | 'AWAITING_ASSETS'
  | 'ASSETS_SUBMITTED'
  | 'ASSETS_UNDER_REVIEW'
  | 'PRODUCTION_STARTED'
  | 'STAGING_REVIEW'
  | 'REVISIONS'
  | 'LIVE';

const PORTFOLIO_TRANSITIONS: Record<PortfolioStatus, PortfolioStatus[]> = {
  DRAFT:                ['AWAITING_ASSETS'],
  AWAITING_ASSETS:      ['ASSETS_SUBMITTED'],
  ASSETS_SUBMITTED:     ['ASSETS_UNDER_REVIEW'],
  ASSETS_UNDER_REVIEW:  ['PRODUCTION_STARTED'],
  PRODUCTION_STARTED:   ['STAGING_REVIEW'],
  STAGING_REVIEW:       ['REVISIONS', 'LIVE'],
  REVISIONS:            ['STAGING_REVIEW', 'LIVE'],
  LIVE:                 [],
};

export function canTransitionPortfolio(from: PortfolioStatus, to: PortfolioStatus): boolean {
  return PORTFOLIO_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedPortfolioTransitions(from: PortfolioStatus): PortfolioStatus[] {
  return PORTFOLIO_TRANSITIONS[from] ?? [];
}

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  DRAFT:                'Borrador',
  AWAITING_ASSETS:      'Esperando materiales',
  ASSETS_SUBMITTED:     'Materiales enviados',
  ASSETS_UNDER_REVIEW:  'Materiales en revisión',
  PRODUCTION_STARTED:   'En producción',
  STAGING_REVIEW:       'Revisión de staging',
  REVISIONS:            'En revisiones',
  LIVE:                 'Publicado',
};

// ─── Helpers para la UI ───────────────────────────────────

/** Estados donde el cliente puede ver/interactuar con el portal de assets */
export const ASSET_PORTAL_STATES: ProjectStatus[] = [
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
];

/** Estados donde el admin debe tomar acción en la cola de revisión */
export const ADMIN_REVIEW_QUEUE_STATES: ProjectStatus[] = [
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
];

/** Estados donde el proyecto está activo (suscripción debe estar activa) */
export const ACTIVE_SUBSCRIPTION_STATES: ProjectStatus[] = [
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'LIVE',
];

/** Estados en fase de Pre-venta */
export const PRE_VENTA_STATES: ProjectStatus[] = [
  'DRAFT',
  'REQUIRES_REVIEW',
  'PROPOSAL_SENT',
  'PROPOSAL_EXPIRED',
  'PAYMENT_RECEIVED',
];

/** Estados en fase de Onboarding */
export const ONBOARDING_STATES: ProjectStatus[] = [
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'ASSETS_INCOMPLETE',
];

/** Estados en fase de Producción */
export const PRODUCTION_STATES: ProjectStatus[] = [
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
];

/** Estados en fase Activos */
export const ACTIVE_STATES: ProjectStatus[] = ['LIVE', 'SUSPENDED'];

/** Estados terminales (Cerrados) */
export const CLOSED_STATES: ProjectStatus[] = ['CANCELLED', 'CLOSED'];

/** El estado CLOSED es exclusivo de proyectos LEGACY */
export const LEGACY_TERMINAL_STATE: ProjectStatus = 'CLOSED';
