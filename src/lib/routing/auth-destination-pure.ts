/**
 * Pure, DB-free routing logic for resolved user destinations.
 * Importable in both server code and unit tests without a DB connection.
 */
import { isAdminPath, isPortalPath } from "./host-context";

export type UserRole = "admin" | "client" | "unassigned";

/**
 * Given a role and a sanitized requestedRedirect, returns the destination URL.
 *
 * Rules:
 * - Admin: /dashboard → /admin (special: /dashboard is in ADMIN_SAFE_PATHS but
 *   admins belong at /admin, not the portal dashboard).
 *   Other explicit admin paths → preserved. Anything else → /admin.
 * - Client: admin paths → /dashboard (security wall). Portal/dashboard → preserved.
 * - Unassigned: /portal/activar (safe holding page, no internal data exposed).
 */
export function resolveDestinationForRole(
  role: UserRole,
  requestedRedirect: string,
): string {
  if (role === "admin") {
    // /dashboard is in ADMIN_SAFE_PATHS but admins should land at /admin, not portal
    if (requestedRedirect === "/dashboard") return "/admin";
    if (isAdminPath(requestedRedirect)) return requestedRedirect;
    return "/admin";
  }

  if (role === "client") {
    // Portal paths are always safe — check before isAdminPath because some paths
    // (e.g. /incidencias, /facturacion) appear in both PORTAL_SAFE_PATHS and ADMIN_SAFE_PATHS
    if (isPortalPath(requestedRedirect) || requestedRedirect === "/dashboard") {
      return requestedRedirect;
    }
    // Block admin-only paths that are not portal paths
    if (isAdminPath(requestedRedirect)) return "/dashboard";
    return "/dashboard";
  }

  // Unassigned — safe holding page with no internal data
  return "/portal/activar";
}
