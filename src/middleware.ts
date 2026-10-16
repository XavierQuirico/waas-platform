import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getHostContext, isPublicPath } from '@/lib/routing/host-context';

const IS_PROD = process.env.NODE_ENV === 'production';
const PORTAL_ORIGIN = IS_PROD ? 'https://portal.quiricostudios.com' : null;
const ADMIN_ORIGIN = IS_PROD ? 'https://admin.quiricostudios.com' : null;
const PUBLIC_ORIGIN = IS_PROD ? 'https://quiricostudios.com' : null;

// Maps clean admin-subdomain path → internal /admin/... path for rewriting
function getAdminInternalRewrite(pathname: string): string | null {
  if (pathname === '/dashboard') return '/admin';

  // Routes with potential sub-paths
  if (pathname === '/proyectos' || pathname.startsWith('/proyectos/')) {
    return '/admin' + pathname;
  }

  // Single-level admin routes (also support sub-paths for safety)
  const adminRoutes = [
    '/clientes', '/sitios', '/tickets', '/incidencias', '/calculadora',
    '/cotizaciones', '/facturacion', '/insights', '/notificaciones',
    '/configuracion', '/feriados', '/dev',
  ];
  for (const route of adminRoutes) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return '/admin' + pathname;
    }
  }

  return null;
}

// Maps legacy /admin/* path → clean path on admin subdomain (for immediate redirect)
function getAdminCleanRedirect(pathname: string): string | null {
  if (pathname === '/admin') return '/dashboard';
  if (pathname.startsWith('/admin/')) return pathname.slice('/admin'.length);
  return null;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/trpc/');
}

// /billing and /portal/billing are legacy aliases; returns canonical path or null
function getBillingCanonicalPath(pathname: string): string | null {
  if (pathname === '/billing' || pathname.startsWith('/billing/')) return '/facturacion';
  if (pathname === '/portal/billing' || pathname.startsWith('/portal/billing/')) return '/facturacion';
  return null;
}

// Portal client-only paths (public host in prod → redirect to portal subdomain)
const PORTAL_CLIENT_PATHS = [
  '/dashboard', '/proyecto', '/mi-sitio', '/cambios-y-mejoras',
  '/incidencias', '/facturacion', '/mantenimiento', '/soporte', '/onboarding',
  '/configuracion',
];

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const search = req.nextUrl.search;
  const host = req.headers.get('host') ?? '';
  const hostCtx = getHostContext(host);

  const headers = new Headers(req.headers);

  // ═══════════════ ADMIN SUBDOMAIN ═══════════════
  if (hostCtx === 'admin') {
    // Immediate public redirects (no auth check needed)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // /billing and /portal/billing → portal's /facturacion BEFORE the generic /portal* handler
    const billingCanonical = getBillingCanonicalPath(pathname);
    if (billingCanonical) {
      const dest = PORTAL_ORIGIN
        ? `${PORTAL_ORIGIN}${billingCanonical}`
        : new URL(billingCanonical, req.url).toString();
      return NextResponse.redirect(dest);
    }

    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      const dest = PORTAL_ORIGIN
        ? `${PORTAL_ORIGIN}/dashboard`
        : new URL('/acceder', req.url).toString();
      return NextResponse.redirect(dest);
    }

    // Legacy /admin/* → clean path redirect (immediate, no auth)
    const legacyClean = getAdminCleanRedirect(pathname);
    if (legacyClean) {
      return NextResponse.redirect(new URL(legacyClean + search, req.url));
    }

    // Compute internal rewrite target (don't apply yet)
    const rewritePath = getAdminInternalRewrite(pathname);

    // Auth check for private routes
    if (!isPublicPath(pathname)) {
      const { userId } = await auth();
      if (!userId && isApiPath(pathname)) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      if (!userId) {
        const encoded = encodeURIComponent(pathname + search);
        return NextResponse.redirect(new URL(`/acceder?redirect_url=${encoded}`, req.url));
      }
    }

    headers.set('x-pathname', pathname);

    if (rewritePath) {
      const internalUrl = new URL(rewritePath + search, req.url);
      return NextResponse.rewrite(internalUrl, { request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  }

  // ═══════════════ PORTAL SUBDOMAIN ═══════════════
  if (hostCtx === 'portal') {
    // Immediate public redirects
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // /billing and /portal/billing → /facturacion BEFORE the generic /portal* handler
    const billingCanonical = getBillingCanonicalPath(pathname);
    if (billingCanonical) {
      return NextResponse.redirect(new URL(billingCanonical, req.url));
    }

    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const dest = ADMIN_ORIGIN
        ? `${ADMIN_ORIGIN}/dashboard`
        : new URL('/acceder', req.url).toString();
      return NextResponse.redirect(dest);
    }

    // /empezar on portal subdomain → public domain in production
    if (pathname.startsWith('/empezar') && PUBLIC_ORIGIN) {
      return NextResponse.redirect(`${PUBLIC_ORIGIN}${pathname}${search}`);
    }

    // Auth check for private routes
    if (!isPublicPath(pathname)) {
      const { userId } = await auth();
      if (!userId && isApiPath(pathname)) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      if (!userId) {
        const encoded = encodeURIComponent(pathname + search);
        return NextResponse.redirect(new URL(`/acceder?redirect_url=${encoded}`, req.url));
      }
    }

    headers.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers } });
  }

  // ═══════════════ PUBLIC HOST (production) ═══════════════
  if (hostCtx === 'public') {
    // Portal paths → portal subdomain
    if (PORTAL_ORIGIN) {
      // /billing and /portal/billing must resolve before the generic /portal* handler
      const billingCanonical = getBillingCanonicalPath(pathname);
      if (billingCanonical) {
        return NextResponse.redirect(`${PORTAL_ORIGIN}${billingCanonical}${search}`);
      }
      if (pathname === '/portal' || pathname.startsWith('/portal/')) {
        return NextResponse.redirect(`${PORTAL_ORIGIN}/dashboard`);
      }
      for (const p of PORTAL_CLIENT_PATHS) {
        if (pathname === p || pathname.startsWith(p + '/')) {
          return NextResponse.redirect(`${PORTAL_ORIGIN}${pathname}${search}`);
        }
      }
    }

    // Admin paths → admin subdomain
    if (ADMIN_ORIGIN) {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        const cleanPath = pathname === '/admin' ? '/dashboard' : pathname.slice('/admin'.length);
        return NextResponse.redirect(`${ADMIN_ORIGIN}${cleanPath}${search}`);
      }
    }
  }

  // ═══════════════ DEV HOST ═══════════════
  if (hostCtx === 'dev') {
    // /billing and /portal/billing → /facturacion before generic /portal* handler
    const billingCanonical = getBillingCanonicalPath(pathname);
    if (billingCanonical) {
      return NextResponse.redirect(new URL(billingCanonical, req.url));
    }

    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.redirect(
          new URL('/acceder?redirect_url=%2Fdashboard', req.url),
        );
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // ═══════════════ DEFAULT: public/dev standard auth ═══════════════
  if (!isPublicPath(pathname)) {
    const { userId } = await auth();
    if (!userId && isApiPath(pathname)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (!userId) {
      const encoded = encodeURIComponent(pathname + search);
      return NextResponse.redirect(new URL(`/acceder?redirect_url=${encoded}`, req.url));
    }
  }

  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|otf|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
