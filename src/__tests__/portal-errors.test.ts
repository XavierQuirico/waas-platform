/**
 * Guards the error-semantics fix: only the expected
 * not-found/forbidden project error may be translated into a 404. Any other
 * error (DB/runtime/schema) must NOT be recognised by the guard, so pages
 * re-throw it and Next renders a real error instead of a misleading 404.
 */
import { describe, expect, it } from 'vitest';
import {
  PortalProjectNotFoundError,
  isPortalProjectNotFoundError,
} from '@/lib/portal/errors';

describe('isPortalProjectNotFoundError', () => {
  it('recognises a PortalProjectNotFoundError instance', () => {
    expect(isPortalProjectNotFoundError(new PortalProjectNotFoundError())).toBe(true);
  });

  it('recognises a plain object carrying the same code (serialization-safe)', () => {
    expect(isPortalProjectNotFoundError({ code: 'PORTAL_PROJECT_NOT_FOUND' })).toBe(true);
  });

  it('does NOT recognise a generic Error (would be a silenced real failure)', () => {
    expect(isPortalProjectNotFoundError(new Error('connect ECONNREFUSED'))).toBe(false);
  });

  it('does NOT recognise a DB/syntax error', () => {
    const dbError = Object.assign(new Error('column "foo" does not exist'), { code: '42703' });
    expect(isPortalProjectNotFoundError(dbError)).toBe(false);
  });

  it('does NOT recognise null/undefined/string/number', () => {
    expect(isPortalProjectNotFoundError(null)).toBe(false);
    expect(isPortalProjectNotFoundError(undefined)).toBe(false);
    expect(isPortalProjectNotFoundError('not found')).toBe(false);
    expect(isPortalProjectNotFoundError(404)).toBe(false);
  });

  it('preserves the human message used by server actions', () => {
    expect(new PortalProjectNotFoundError().message).toBe('No tienes acceso a este proyecto.');
  });
});
