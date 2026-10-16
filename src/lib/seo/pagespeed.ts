// ============================================================
// PageSpeed Insights API v5 — Helper
// Documentación: https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed
// API key: GOOGLE_PAGESPEED_API_KEY (25k requests/día gratuitos)
// Una sola key maneja todos los clientes
// ============================================================

import type { SeoIssue } from '@/db/schema/seo-reports';

const PAGESPEED_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Audits de oportunidad/diagnóstico con mayor impacto en performance
const OPPORTUNITY_AUDITS = [
  'render-blocking-resources',
  'unused-css-rules',
  'unused-javascript',
  'uses-optimized-images',
  'uses-responsive-images',
  'uses-webp-images',
  'offscreen-images',
  'total-blocking-time',
  'uses-long-cache-ttl',
  'efficient-animated-content',
  'uses-text-compression',
];

export interface PageSpeedResult {
  status: 'ok' | 'site_unreachable' | 'api_error';
  lighthouseScore: number | null;
  cruxScore: string | null;
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  topIssues: SeoIssue[];
  rawData: unknown;
}

// Verifica que el sitio responde antes de llamar a PageSpeed
export async function checkSiteAvailability(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

// Llama a PageSpeed API y devuelve resultado tipado
export async function runPageSpeed(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PAGESPEED_API_KEY not configured');

  const endpoint = `${PAGESPEED_BASE}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${apiKey}`;

  let raw: unknown;
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) {
      return { status: 'api_error', lighthouseScore: null, cruxScore: null, lcpMs: null, clsScore: null, inpMs: null, topIssues: [], rawData: null };
    }
    raw = await res.json();
  } catch {
    return { status: 'api_error', lighthouseScore: null, cruxScore: null, lcpMs: null, clsScore: null, inpMs: null, topIssues: [], rawData: null };
  }

  const data = raw as Record<string, unknown>;

  // ─── Lighthouse score (0-100) ─────────────────────────
  const lhResult = data.lighthouseResult as Record<string, unknown> | undefined;
  const perfScore = (lhResult?.categories as Record<string, unknown> | undefined)?.performance;
  const lighthouseScore = typeof (perfScore as Record<string, unknown>)?.score === 'number'
    ? Math.round(((perfScore as Record<string, unknown>).score as number) * 100)
    : null;

  // ─── CrUX score (datos reales de usuarios) ────────────
  const loadingExp = data.loadingExperience as Record<string, unknown> | undefined;
  const cruxScore = typeof loadingExp?.overall_category === 'string'
    ? loadingExp.overall_category
    : null;

  // ─── Core Web Vitals (de Lighthouse) ─────────────────
  const audits = lhResult?.audits as Record<string, Record<string, unknown>> | undefined;

  const lcpMs = typeof audits?.['largest-contentful-paint']?.numericValue === 'number'
    ? Math.round(audits['largest-contentful-paint'].numericValue as number)
    : null;

  const clsScore = typeof audits?.['cumulative-layout-shift']?.numericValue === 'number'
    ? (audits['cumulative-layout-shift'].numericValue as number)
    : null;

  const inpMs = typeof audits?.['interaction-to-next-paint']?.numericValue === 'number'
    ? Math.round(audits['interaction-to-next-paint'].numericValue as number)
    : null;

  // ─── Top 3 issues por impacto ─────────────────────────
  const topIssues: SeoIssue[] = [];

  if (audits) {
    const issues = OPPORTUNITY_AUDITS
      .map((id) => {
        const audit = audits[id];
        if (!audit) return null;
        const score = typeof audit.score === 'number' ? audit.score : 1;
        const title = typeof audit.title === 'string' ? audit.title : id;
        if (score >= 0.9) return null;
        return { id, title, score };
      })
      .filter((x): x is { id: string; title: string; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    for (const issue of issues) {
      const severity: SeoIssue['severity'] = issue.score < 0.5 ? 'high' : 'medium';
      topIssues.push({ id: issue.id, title: issue.title, severity });
    }
  }

  return {
    status: 'ok',
    lighthouseScore,
    cruxScore,
    lcpMs,
    clsScore,
    inpMs,
    topIssues,
    rawData: raw,
  };
}
