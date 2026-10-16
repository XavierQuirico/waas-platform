import { describe, it, expect } from 'vitest';
import { validateStagingChangesFeedback } from '@/lib/portal/staging-feedback-validation';
import type { StagingFeedbackItem } from '@/db/schema';

describe('validateStagingChangesFeedback', () => {
  it('rechaza lista con solo approved', () => {
    const items: StagingFeedbackItem[] = [
      { section: 'General', status: 'approved' },
    ];
    expect(() => validateStagingChangesFeedback(items)).toThrow('Incluye al menos un cambio');
  });

  it('rechaza changes sin comentario', () => {
    const items: StagingFeedbackItem[] = [
      { section: 'Hero', status: 'changes' },
    ];
    expect(() => validateStagingChangesFeedback(items)).toThrow('necesita descripción');
  });

  it('rechaza changes con comentario vacío/espacios', () => {
    const items: StagingFeedbackItem[] = [
      { section: 'Hero', status: 'changes', comment: '   ' },
    ];
    expect(() => validateStagingChangesFeedback(items)).toThrow('necesita descripción');
  });

  it('acepta un change con comentario válido', () => {
    const items: StagingFeedbackItem[] = [
      { section: 'Hero', status: 'changes', comment: 'Cambiar el texto del botón.' },
    ];
    expect(() => validateStagingChangesFeedback(items)).not.toThrow();
  });

  it('acepta mezcla approved + changes válido', () => {
    const items: StagingFeedbackItem[] = [
      { section: 'Hero', status: 'approved' },
      { section: 'Contacto', status: 'changes', comment: 'Actualizar WhatsApp.' },
    ];
    expect(() => validateStagingChangesFeedback(items)).not.toThrow();
  });

  it('rechaza array vacío', () => {
    expect(() => validateStagingChangesFeedback([])).toThrow('Incluye al menos un cambio');
  });
});
