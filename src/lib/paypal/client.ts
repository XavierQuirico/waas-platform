// ============================================================
// PayPal HTTP Client — WaaS
// OAuth Bearer cacheado (~9h). Soporta PayPal-Request-Id para
// idempotencia. Logs sanitizados — nunca expone tokens ni secretos.
// ============================================================

export const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// Cache del access token en memoria (válido ~9h, renovado con 5min de margen)
let cachedToken: { token: string; expiresAt: number } | null = null;

const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout),
  );
}

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[PayPal] PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET no configurados.');
  }

  const res = await fetchWithTimeout(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`[PayPal] Token fetch failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface PayPalFetchOptions {
  /** Clave de idempotencia estable por operación */
  requestId?: string;
  /** Headers adicionales */
  extraHeaders?: Record<string, string>;
}

/**
 * Realiza una llamada autenticada a la API de PayPal.
 * Logs sanitizados: muestra operación y código HTTP, nunca tokens ni payloads completos.
 */
export async function paypalFetch<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  opts: PayPalFetchOptions = {},
): Promise<T> {
  const token = await getPayPalAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...opts.extraHeaders,
  };

  if (opts.requestId) {
    headers['PayPal-Request-Id'] = opts.requestId;
  }

  const res = await fetchWithTimeout(`${PAYPAL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // No exponer el body completo de PayPal en los logs
    const status = res.status;
    console.error(`[PayPal] ${method} ${path} → HTTP ${status}`);
    const text = await res.text().catch(() => '');
    // Sanitiza: elimina tokens Bearer del mensaje de error de PayPal
    const safeText = text.replace(/"access_token":"[^"]+"/g, '"access_token":"[redacted]"').slice(0, 300);
    throw new Error(`[PayPal] ${method} ${path} → ${status}: ${safeText}`);
  }

  return res.json() as Promise<T>;
}

/** Genera un PayPal-Request-Id estable y determinista para un ticket + revisión */
export function buildPayPalRequestId(prefix: string, ticketId: string, revision: number): string {
  return `${prefix}-${ticketId}-r${revision}`;
}
