import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/lib/security/headers';

const isDev = process.env.NODE_ENV !== 'production';

// Solo se permiten imágenes remotas del bucket configurado; sin la variable
// (p. ej. en CI) se acepta cualquier bucket de Cloudflare R2.
function r2ImageHostname(): string {
  try {
    return process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).hostname : '*.r2.cloudflarestorage.com';
  } catch {
    return '*.r2.cloudflarestorage.com';
  }
}

// La clave publicable de Clerk lleva codificado el host de su Frontend API
// (pk_test_<base64>, pk_live_<base64>). Permitirlo explícitamente evita romper
// el login cuando se usa un dominio propio de Clerk en producción.
function clerkFrontendOrigin(): string[] {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const encoded = key?.split('_')[2];
  if (!encoded) return [];
  try {
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? [`https://${host}`] : [];
  } catch {
    return [];
  }
}

const extraOrigins = (process.env.CSP_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: r2ImageHostname() }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({
          isDev,
          appOrigins: [...clerkFrontendOrigin(), ...extraOrigins],
        }),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
