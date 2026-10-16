import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  PROJECT_STATUS_LABELS,
  ASSET_PORTAL_STATES,
  ADMIN_REVIEW_QUEUE_STATES,
  ACTIVE_SUBSCRIPTION_STATES,
  type ProjectStatus,
} from '@/lib/projects/state-machine';

describe('canTransition', () => {
  // ─── Transiciones válidas del flujo principal ───────────────────────────

  it('DRAFT → PROPOSAL_SENT', () => {
    expect(canTransition('DRAFT', 'PROPOSAL_SENT')).toBe(true);
  });

  it('DRAFT → REQUIRES_REVIEW', () => {
    expect(canTransition('DRAFT', 'REQUIRES_REVIEW')).toBe(true);
  });

  it('REQUIRES_REVIEW → PROPOSAL_SENT', () => {
    expect(canTransition('REQUIRES_REVIEW', 'PROPOSAL_SENT')).toBe(true);
  });

  it('PROPOSAL_SENT → PAYMENT_RECEIVED', () => {
    expect(canTransition('PROPOSAL_SENT', 'PAYMENT_RECEIVED')).toBe(true);
  });

  it('PROPOSAL_SENT → PROPOSAL_EXPIRED', () => {
    expect(canTransition('PROPOSAL_SENT', 'PROPOSAL_EXPIRED')).toBe(true);
  });

  it('PROPOSAL_EXPIRED → PROPOSAL_SENT (re-send)', () => {
    expect(canTransition('PROPOSAL_EXPIRED', 'PROPOSAL_SENT')).toBe(true);
  });

  it('PAYMENT_RECEIVED → AWAITING_ASSETS', () => {
    expect(canTransition('PAYMENT_RECEIVED', 'AWAITING_ASSETS')).toBe(true);
  });

  it('AWAITING_ASSETS → ASSETS_SUBMITTED', () => {
    expect(canTransition('AWAITING_ASSETS', 'ASSETS_SUBMITTED')).toBe(true);
  });

  it('ASSETS_SUBMITTED → ASSETS_UNDER_REVIEW', () => {
    expect(canTransition('ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW')).toBe(true);
  });

  it('ASSETS_UNDER_REVIEW → ASSETS_INCOMPLETE', () => {
    expect(canTransition('ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE')).toBe(true);
  });

  it('ASSETS_UNDER_REVIEW → PRODUCTION_STARTED', () => {
    expect(canTransition('ASSETS_UNDER_REVIEW', 'PRODUCTION_STARTED')).toBe(true);
  });

  it('ASSETS_INCOMPLETE → ASSETS_SUBMITTED (re-upload)', () => {
    expect(canTransition('ASSETS_INCOMPLETE', 'ASSETS_SUBMITTED')).toBe(true);
  });

  it('PRODUCTION_STARTED → STAGING_REVIEW', () => {
    expect(canTransition('PRODUCTION_STARTED', 'STAGING_REVIEW')).toBe(true);
  });

  it('STAGING_REVIEW → REVISIONS', () => {
    expect(canTransition('STAGING_REVIEW', 'REVISIONS')).toBe(true);
  });

  it('STAGING_REVIEW → LIVE (aprobación directa)', () => {
    expect(canTransition('STAGING_REVIEW', 'LIVE')).toBe(true);
  });

  it('REVISIONS → STAGING_REVIEW (loop)', () => {
    expect(canTransition('REVISIONS', 'STAGING_REVIEW')).toBe(true);
  });

  it('REVISIONS → LIVE', () => {
    expect(canTransition('REVISIONS', 'LIVE')).toBe(true);
  });

  it('REVISIONS → REVISIONS_DONE', () => {
    expect(canTransition('REVISIONS', 'REVISIONS_DONE')).toBe(true);
  });

  it('REVISIONS_DONE → LIVE', () => {
    expect(canTransition('REVISIONS_DONE', 'LIVE')).toBe(true);
  });

  it('LIVE → SUSPENDED', () => {
    expect(canTransition('LIVE', 'SUSPENDED')).toBe(true);
  });

  it('LIVE → CANCELLED', () => {
    expect(canTransition('LIVE', 'CANCELLED')).toBe(true);
  });

  it('SUSPENDED → LIVE (reactivar)', () => {
    expect(canTransition('SUSPENDED', 'LIVE')).toBe(true);
  });

  it('SUSPENDED → CANCELLED', () => {
    expect(canTransition('SUSPENDED', 'CANCELLED')).toBe(true);
  });

  // ─── Transiciones inválidas ────────────────────────────────────────────

  it('CANCELLED → nada (estado terminal)', () => {
    expect(canTransition('CANCELLED', 'LIVE')).toBe(false);
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(false);
    expect(canTransition('CANCELLED', 'SUSPENDED')).toBe(false);
  });

  it('LIVE → DRAFT (salto inválido)', () => {
    expect(canTransition('LIVE', 'DRAFT')).toBe(false);
  });

  it('AWAITING_ASSETS → PRODUCTION_STARTED (saltar fases)', () => {
    expect(canTransition('AWAITING_ASSETS', 'PRODUCTION_STARTED')).toBe(false);
  });

  it('PAYMENT_RECEIVED → LIVE (saltar fases)', () => {
    expect(canTransition('PAYMENT_RECEIVED', 'LIVE')).toBe(false);
  });

  it('STAGING_REVIEW → ASSETS_SUBMITTED (retroceder)', () => {
    expect(canTransition('STAGING_REVIEW', 'ASSETS_SUBMITTED')).toBe(false);
  });

  it('REQUIRES_REVIEW → PAYMENT_RECEIVED (sin propuesta)', () => {
    expect(canTransition('REQUIRES_REVIEW', 'PAYMENT_RECEIVED')).toBe(false);
  });
});

describe('getAllowedTransitions', () => {
  it('DRAFT tiene 2 transiciones operativas + cancelación global', () => {
    expect(getAllowedTransitions('DRAFT')).toHaveLength(3);
    expect(getAllowedTransitions('DRAFT')).toContain('PROPOSAL_SENT');
    expect(getAllowedTransitions('DRAFT')).toContain('REQUIRES_REVIEW');
    expect(getAllowedTransitions('DRAFT')).toContain('CANCELLED');
  });

  it('CANCELLED no tiene transiciones', () => {
    expect(getAllowedTransitions('CANCELLED')).toHaveLength(0);
  });

  it('ASSETS_UNDER_REVIEW tiene 2 transiciones operativas + cancelación global', () => {
    const transitions = getAllowedTransitions('ASSETS_UNDER_REVIEW');
    expect(transitions).toHaveLength(3);
    expect(transitions).toContain('ASSETS_INCOMPLETE');
    expect(transitions).toContain('PRODUCTION_STARTED');
    expect(transitions).toContain('CANCELLED');
  });

  it('REVISIONS tiene 3 transiciones operativas + cancelación global', () => {
    const transitions = getAllowedTransitions('REVISIONS');
    expect(transitions).toHaveLength(4);
    expect(transitions).toContain('STAGING_REVIEW');
    expect(transitions).toContain('LIVE');
    expect(transitions).toContain('REVISIONS_DONE');
    expect(transitions).toContain('CANCELLED');
  });

  it('STAGING_REVIEW tiene 2 transiciones operativas + cancelación global', () => {
    const transitions = getAllowedTransitions('STAGING_REVIEW');
    expect(transitions).toHaveLength(3);
    expect(transitions).toContain('REVISIONS');
    expect(transitions).toContain('LIVE');
    expect(transitions).toContain('CANCELLED');
  });
});

describe('PROJECT_STATUS_LABELS', () => {
  it('todos los estados tienen etiqueta', () => {
    const allStatuses: ProjectStatus[] = [
      'DRAFT', 'PROPOSAL_SENT', 'REQUIRES_REVIEW', 'PROPOSAL_EXPIRED',
      'PAYMENT_RECEIVED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED',
      'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE', 'PRODUCTION_STARTED',
      'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE',
      'SUSPENDED', 'CANCELLED',
    ];
    for (const status of allStatuses) {
      expect(PROJECT_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe('state groups', () => {
  it('ASSET_PORTAL_STATES incluye AWAITING_ASSETS y ASSETS_INCOMPLETE', () => {
    expect(ASSET_PORTAL_STATES).toContain('AWAITING_ASSETS');
    expect(ASSET_PORTAL_STATES).toContain('ASSETS_INCOMPLETE');
  });

  it('ADMIN_REVIEW_QUEUE_STATES no incluye AWAITING_ASSETS', () => {
    expect(ADMIN_REVIEW_QUEUE_STATES).not.toContain('AWAITING_ASSETS');
  });

  it('ACTIVE_SUBSCRIPTION_STATES incluye LIVE', () => {
    expect(ACTIVE_SUBSCRIPTION_STATES).toContain('LIVE');
    expect(ACTIVE_SUBSCRIPTION_STATES).not.toContain('CANCELLED');
  });
});
