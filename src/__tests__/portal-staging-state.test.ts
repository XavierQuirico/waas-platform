import { describe, it, expect } from 'vitest';
import {
  derivePortalStagingVisualState,
  getPortalStagingCopy,
  type StagingFeedbackSummary,
} from '@/lib/portal/staging-state';

const emptyFeedback: StagingFeedbackSummary = {
  count: 0,
  lastSubmittedAt: null,
  lastAllApproved: null,
  lastHasChanges: false,
};

describe('derivePortalStagingVisualState', () => {
  it('STAGING_REVIEW sin feedback => ready', () => {
    expect(
      derivePortalStagingVisualState({ status: 'STAGING_REVIEW', feedback: emptyFeedback })
    ).toBe('ready');
  });

  it('STAGING_REVIEW con lastAllApproved true => approved', () => {
    expect(
      derivePortalStagingVisualState({
        status: 'STAGING_REVIEW',
        feedback: { ...emptyFeedback, lastAllApproved: true, count: 1 },
      })
    ).toBe('approved');
  });

  it('STAGING_REVIEW con lastHasChanges true => feedback_sent', () => {
    expect(
      derivePortalStagingVisualState({
        status: 'STAGING_REVIEW',
        feedback: { ...emptyFeedback, lastHasChanges: true, count: 1 },
      })
    ).toBe('feedback_sent');
  });

  it('REVISIONS => revisions_in_progress', () => {
    expect(
      derivePortalStagingVisualState({ status: 'REVISIONS', feedback: emptyFeedback })
    ).toBe('revisions_in_progress');
  });

  it('REVISIONS_DONE => revisions_done', () => {
    expect(
      derivePortalStagingVisualState({ status: 'REVISIONS_DONE', feedback: emptyFeedback })
    ).toBe('revisions_done');
  });

  it('LIVE => live', () => {
    expect(
      derivePortalStagingVisualState({ status: 'LIVE', feedback: emptyFeedback })
    ).toBe('live');
  });

  it('CLOSED => closed', () => {
    expect(
      derivePortalStagingVisualState({ status: 'CLOSED', feedback: emptyFeedback })
    ).toBe('closed');
  });

  it('PRODUCTION_STARTED => unavailable', () => {
    expect(
      derivePortalStagingVisualState({ status: 'PRODUCTION_STARTED', feedback: emptyFeedback })
    ).toBe('unavailable');
  });

  it('approved tiene prioridad sobre lastHasChanges cuando lastAllApproved es true', () => {
    expect(
      derivePortalStagingVisualState({
        status: 'STAGING_REVIEW',
        feedback: { count: 1, lastSubmittedAt: new Date(), lastAllApproved: true, lastHasChanges: true },
      })
    ).toBe('approved');
  });
});

describe('getPortalStagingCopy', () => {
  it('ready devuelve título "Revisa tu preview"', () => {
    expect(getPortalStagingCopy('ready').title).toBe('Revisa tu preview');
  });

  it('approved no dice que el sitio ya está publicado', () => {
    const copy = getPortalStagingCopy('approved');
    expect(copy.description.toLowerCase()).not.toMatch(/ya está publicado/);
    expect(copy.description.toLowerCase()).not.toMatch(/sitio ya está/);
  });

  it('approved tiene badge "Preview aprobado"', () => {
    expect(getPortalStagingCopy('approved').badge).toBe('Preview aprobado');
  });

  it('revisions_in_progress tiene badge "En revisiones"', () => {
    expect(getPortalStagingCopy('revisions_in_progress').badge).toBe('En revisiones');
  });

  it('live tiene badge "Publicado"', () => {
    expect(getPortalStagingCopy('live').badge).toBe('Publicado');
  });

  it('unavailable tiene badge "No disponible"', () => {
    expect(getPortalStagingCopy('unavailable').badge).toBe('No disponible');
  });

  it('todos los estados tienen badge, title y description no vacíos', () => {
    const states = [
      'ready', 'approved', 'feedback_sent', 'revisions_in_progress',
      'revisions_done', 'live', 'closed', 'unavailable',
    ] as const;
    for (const state of states) {
      const copy = getPortalStagingCopy(state);
      expect(copy.badge.length).toBeGreaterThan(0);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
    }
  });
});
