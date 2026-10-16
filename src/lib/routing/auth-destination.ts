/**
 * Server-only helper for resolving authenticated user destination.
 * Determines role from DB (admins table) + env (ADMIN_CLERK_USER_ID),
 * never from query params or user-supplied context.
 */

import { db } from "@/db";
import { admins, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveDestinationForRole } from "./auth-destination-pure";
import { linkPendingClientForUser } from "@/lib/portal/link-pending-client";

export type { UserRole } from "./auth-destination-pure";
export { resolveDestinationForRole } from "./auth-destination-pure";

/**
 * Resolves role for a given Clerk userId.
 * Source of truth: admins table + ADMIN_CLERK_USER_ID env var for admin,
 * clients table for portal client.
 */
export async function resolveUserRole(
  userId: string,
): Promise<import("./auth-destination-pure").UserRole> {
  if (userId === process.env.ADMIN_CLERK_USER_ID) return "admin";

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  if (admin) return "admin";

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clerkUserId, userId))
    .limit(1);

  if (client) return "client";

  // Primer acceso tras registrarse: el cliente creado en el wizard anónimo aún
  // está pendiente. Se enlaza por el email verificado de la cuenta; sin este
  // paso la persona quedaba "sin asignar" y volvía en bucle a la pantalla de activación.
  const link = await linkPendingClientForUser(userId);
  if (link.status === "linked") return "client";

  return "unassigned";
}

/**
 * Given an authenticated userId and a sanitized requestedRedirect,
 * returns the safe destination URL for that user.
 */
export async function resolveAuthenticatedAccessDestination(
  userId: string,
  requestedRedirect: string,
): Promise<string> {
  const role = await resolveUserRole(userId);
  return resolveDestinationForRole(role, requestedRedirect);
}
