/**
 * Typed portal errors.
 *
 * `PortalProjectNotFoundError` marks the ONE expected failure that a project
 * route may translate into a 404: the requested project does not exist or does
 * not belong to the authenticated client. Any other failure (DB outage, schema
 * drift, runtime bug) must propagate so Next renders a real error instead of a
 * misleading "page not found". See the `catch` blocks in /proyecto/[projectId]/*.
 */
export class PortalProjectNotFoundError extends Error {
  readonly code = 'PORTAL_PROJECT_NOT_FOUND' as const;

  constructor(message = 'No tienes acceso a este proyecto.') {
    super(message);
    this.name = 'PortalProjectNotFoundError';
  }
}

/**
 * Narrow guard for the expected not-found/forbidden project error.
 * Also matches plain objects carrying the same `code`, so the guard stays
 * reliable if the error crosses a serialization boundary.
 */
export function isPortalProjectNotFoundError(
  error: unknown,
): error is PortalProjectNotFoundError {
  if (error instanceof PortalProjectNotFoundError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'PORTAL_PROJECT_NOT_FOUND'
  );
}
