import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getHostContext,
  sanitizeContextualRedirect,
} from "@/lib/routing/host-context";
import { resolveAuthenticatedAccessDestination } from "@/lib/routing/auth-destination";

type SearchParams = Promise<{ redirect_url?: string }>;

/**
 * Server-side destination resolver for post-login routing.
 * Called after Clerk authentication to determine the correct landing page
 * based on the user's role (admin / client / unassigned) — never from query params.
 */
export default async function AccederResolverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, hdrs] = await Promise.all([searchParams, headers()]);
  const host = hdrs.get("host") ?? "";
  const hostCtx = getHostContext(host);

  const redirectCtx =
    hostCtx === "portal" ? "portal" : hostCtx === "admin" ? "admin" : "dev";

  const requested = sanitizeContextualRedirect(params.redirect_url, redirectCtx);

  const { userId } = await auth();
  if (!userId) {
    redirect("/acceder");
  }

  const destination = await resolveAuthenticatedAccessDestination(userId, requested);
  redirect(destination);
}
