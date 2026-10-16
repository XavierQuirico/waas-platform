export type HostContext = 'portal' | 'admin' | 'public' | 'dev';

/**
 * Resolves routing context from the HTTP Host header.
 * Normalizes host: lowercase, strips port.
 */
export function getHostContext(host: string): HostContext {
  const normalized = host.toLowerCase().replace(/:\d+$/, '');
  if (normalized.startsWith('portal.')) return 'portal';
  if (normalized.startsWith('admin.')) return 'admin';
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0'
  ) return 'dev';
  return 'public';
}

// Paths allowed as redirect targets in portal context
const PORTAL_SAFE_PATHS = [
  '/dashboard',
  '/proyecto',
  '/mi-sitio',
  '/cambios-y-mejoras',
  '/incidencias',
  '/facturacion',
  '/mantenimiento',
  '/soporte',
  '/onboarding',
  '/configuracion',
  '/portal/activar',
];

// Clean paths allowed as redirect targets in admin context
const ADMIN_SAFE_PATHS = [
  '/dashboard',
  '/proyectos',
  '/clientes',
  '/sitios',
  '/tickets',
  '/incidencias',
  '/calculadora',
  '/cotizaciones',
  '/facturacion',
  '/insights',
  '/notificaciones',
  '/configuracion',
  '/feriados',
  '/dev',
  '/admin', // dev/compat
];

// Paths allowed as redirect targets in public context
const PUBLIC_SAFE_PATHS = ['/', '/empezar', '/acceder'];

// Paths that unambiguously signal admin context when inferring from redirect_url
const ADMIN_INFER_PATHS = [
  '/proyectos',
  '/clientes',
  '/sitios',
  '/tickets',
  '/calculadora',
  '/cotizaciones',
  '/insights',
  '/notificaciones',
  '/configuracion',
  '/feriados',
  '/dev',
];

function isValidRedirectString(raw: string): boolean {
  if (!raw.startsWith('/')) return false;
  if (raw.startsWith('//')) return false;
  if (raw.includes('\\')) return false;
  // reject control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return false;
  return true;
}

export function sanitizeRedirect(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!isValidRedirectString(raw)) return fallback;
  return raw;
}

export function getDefaultRedirectForContext(context: HostContext): string {
  if (context === 'portal' || context === 'admin' || context === 'dev') return '/dashboard';
  return '/';
}

export function sanitizeContextualRedirect(
  raw: string | undefined,
  context: HostContext,
): string {
  const fallback = getDefaultRedirectForContext(context);
  if (!raw) return fallback;
  if (!isValidRedirectString(raw)) return fallback;

  const allowed =
    context === 'portal' ? PORTAL_SAFE_PATHS :
    context === 'admin' ? ADMIN_SAFE_PATHS :
    context === 'dev' ? [...ADMIN_SAFE_PATHS, ...PORTAL_SAFE_PATHS] :
    PUBLIC_SAFE_PATHS;

  if (allowed.some(p => raw === p || raw.startsWith(p + '/'))) return raw;
  return fallback;
}

/**
 * Infers context from a redirect_url path when no explicit context is known.
 * Used in /acceder when host is 'dev' and no ?context= param.
 */
export function inferContextFromRedirect(
  redirectUrl: string,
): 'portal' | 'admin' | 'public' {
  if (redirectUrl.startsWith('/admin') || redirectUrl === '/admin') return 'admin';
  if (ADMIN_INFER_PATHS.some(p => redirectUrl === p || redirectUrl.startsWith(p + '/'))) return 'admin';
  if (PORTAL_SAFE_PATHS.some(p => redirectUrl === p || redirectUrl.startsWith(p + '/'))) return 'portal';
  return 'public';
}

export function isPortalPath(path: string): boolean {
  return PORTAL_SAFE_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

export function isAdminPath(path: string): boolean {
  return (
    path.startsWith('/admin') ||
    ADMIN_SAFE_PATHS.some(p => path === p || path.startsWith(p + '/'))
  );
}

export function isPublicPath(path: string): boolean {
  return (
    path === '/' ||
    path.startsWith('/empezar') ||
    path.startsWith('/acceder') ||
    path.startsWith('/sign-in') ||
    path.startsWith('/sign-up') ||
    path === '/api/health' ||
    path.startsWith('/api/webhooks') ||
    path.startsWith('/api/inngest') ||
    path.startsWith('/api/trpc/intake')
  );
}

export function isPrivateAppPath(path: string): boolean {
  return !isPublicPath(path);
}

/**
 * Returns the canonical href for an admin link based on the host context.
 * On admin subdomain: /admin/* → /* and /admin → /dashboard.
 * In dev/public: returns path unchanged.
 */
export function adminHref(path: string, ctx: HostContext): string {
  if (ctx !== 'admin') return path;
  if (path === '/admin') return '/dashboard';
  if (path.startsWith('/admin/')) return path.slice('/admin'.length);
  return path;
}
