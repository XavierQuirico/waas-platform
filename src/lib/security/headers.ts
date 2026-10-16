// ============================================================
// Cabeceras de seguridad HTTP
//
// Se aplican a todas las rutas desde next.config.ts. La CSP permite solo los
// orígenes que la aplicación usa de verdad: Clerk (auth), PayPal (pagos),
// Sentry (errores), Vercel (analítica) y Cloudflare R2 (subidas de archivos).
// ============================================================

export interface SecurityHeader {
  key: string;
  value: string;
}

const CLERK_ORIGINS = ['https://*.clerk.accounts.dev', 'https://*.accounts.dev', 'https://*.clerk.com'];
// Clerk Protect (detección de bots) hace sondas a hosts propios por puertos no estándar;
// un origen CSP sin puerto solo cubre el 443, por eso se permite cualquier puerto.
const CLERK_PROTECT_ORIGINS = ['https://*.protect.clerk.com:*'];
const PAYPAL_ORIGINS = [
  'https://www.paypal.com',
  'https://www.sandbox.paypal.com',
  'https://*.paypal.com',
  'https://*.paypalobjects.com',
];
const SENTRY_ORIGINS = ['https://*.ingest.sentry.io', 'https://*.ingest.us.sentry.io'];
const R2_ORIGINS = ['https://*.r2.cloudflarestorage.com'];

export function buildContentSecurityPolicy(options: { isDev: boolean; appOrigins?: string[] }): string {
  const own = options.appOrigins ?? [];

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'", // Next.js inyecta scripts en línea para la hidratación
    ...(options.isDev ? ["'unsafe-eval'"] : []),
    ...CLERK_ORIGINS,
    ...own,
    ...PAYPAL_ORIGINS,
    'https://challenges.cloudflare.com',
    'https://va.vercel-scripts.com',
  ];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      ...CLERK_ORIGINS,
      ...CLERK_PROTECT_ORIGINS,
      ...own,
      ...PAYPAL_ORIGINS,
      ...SENTRY_ORIGINS,
      ...R2_ORIGINS,
      'https://vitals.vercel-insights.com',
      ...(options.isDev ? ['ws:', 'http://localhost:*'] : []),
    ],
    'frame-src': ["'self'", ...CLERK_ORIGINS, ...own, ...PAYPAL_ORIGINS, 'https://challenges.cloudflare.com'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...CLERK_ORIGINS, ...own, ...PAYPAL_ORIGINS],
    'frame-ancestors': ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function buildSecurityHeaders(options: { isDev: boolean; appOrigins?: string[] }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com")',
    },
  ];

  // HSTS solo tiene sentido sobre HTTPS; en desarrollo local se omite.
  if (!options.isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
