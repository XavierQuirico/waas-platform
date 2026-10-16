import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getHostContext,
  sanitizeContextualRedirect,
} from "@/lib/routing/host-context";
import { resolveAuthenticatedAccessDestination } from "@/lib/routing/auth-destination";
import { AnimatedLoginPage } from "@/components/auth/AnimatedLoginPage";

type SearchParams = Promise<{ redirect_url?: string }>;

export default async function AccederPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [params, hdrs] = await Promise.all([searchParams, headers()]);
  const host = hdrs.get("host") ?? "";
  const hostCtx = getHostContext(host);

  // Allow both portal and admin destination paths in dev; honour subdomain in prod
  const redirectCtx =
    hostCtx === "portal" ? "portal" : hostCtx === "admin" ? "admin" : "dev";

  // Sanitize the requested redirect — context= param is ignored for UI/role decisions
  const safeRedirect = sanitizeContextualRedirect(
    params.redirect_url,
    redirectCtx,
  );

  // Already authenticated → resolve destination based on real role (DB, not query param)
  const { userId } = await auth();
  if (userId) {
    const destination = await resolveAuthenticatedAccessDestination(
      userId,
      safeRedirect,
    );
    redirect(destination);
  }

  return <AnimatedLoginPage redirectUrl={safeRedirect} />;
}
