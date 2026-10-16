import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getHostContext } from '@/lib/routing/host-context';
import { PORTAL_ORIGIN } from '@/lib/routing/origins';

// /portal is no longer a product page — it's a routing alias.
// Middleware handles all real subdomain cases. This page is a safety net
// for any request that reaches Next.js rendering.
export default async function PortalPage() {
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const hostCtx = getHostContext(host);

  // Production public host → send to the portal origin (not set in single-host mode)
  if (PORTAL_ORIGIN && hostCtx === 'public') {
    redirect(`${PORTAL_ORIGIN}/dashboard`);
  }

  // Production portal host → to dashboard
  if (hostCtx === 'portal') {
    redirect('/dashboard');
  }

  // Dev/local: check session
  const { userId } = await auth();
  if (!userId) {
    redirect('/acceder?redirect_url=%2Fdashboard');
  }

  redirect('/dashboard');
}
