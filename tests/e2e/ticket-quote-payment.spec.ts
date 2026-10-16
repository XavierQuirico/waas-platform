import { test, expect } from '@playwright/test';

/**
 * E2E spec Cambios y mejoras: quote → PayPal checkout flow
 * Proyecto no-auth: smoke de navegación pública, guards de API, seguridad IDOR.
 *
 * Determinismo en entornos sin internet (CI, Codex, offline):
 * - beforeEach aborta requests a dominios externos para evitar ERR_INTERNET_DISCONNECTED
 *   causado por el CDN de Clerk cuando el usuario no está autenticado.
 * - page.goto() usa waitUntil: 'domcontentloaded' — no espera scripts externos.
 * - page.request.* no se ve afectado por page.route() (contexto HTTP separado).
 */

test.beforeEach(async ({ page }) => {
  // Abort external requests: Clerk CDN, analytics, etc.
  // Prevents ERR_INTERNET_DISCONNECTED in offline/CI environments.
  await page.route(/^https?:\/\/(?!localhost:)/, (route) => route.abort());
});

// ─── Escenario 1: Hub gating por estado de proyecto ──────────────────────────

test.describe('Hub cambios-y-mejoras — gating por estado', () => {
  test('página /cambios-y-mejoras carga sin errores para usuarios no autenticados (redirige a sign-in)', async ({
    page,
  }) => {
    const response = await page.goto('/cambios-y-mejoras', { waitUntil: 'domcontentloaded' });
    // No debe devolver 500
    expect(response?.status()).not.toBe(500);
    // Debe redirigir a sign-in o cargar la página
    const url = page.url();
    expect(url).toMatch(/sign-in|cambios-y-mejoras/);
  });

  test('ruta de detalle de ticket no rompe con ticketNumber inexistente', async ({ page }) => {
    const response = await page.goto('/cambios-y-mejoras/TKT-INEXISTENTE999', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).not.toBe(500);
  });
});

// ─── Escenario 2: Rutas de API PayPal — guards de autenticación ───────────────

test.describe('API PayPal — guards de autenticación (sin auth → 401)', () => {
  test('POST /api/portal/tickets/TKT-TEST/paypal/order sin auth → 401', async ({ page }) => {
    const response = await page.request.post('/api/portal/tickets/TKT-TEST/paypal/order', {
      data: { expectedQuoteRevision: 1 },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/portal/tickets/TKT-TEST/paypal/capture sin auth → 401', async ({ page }) => {
    const response = await page.request.post('/api/portal/tickets/TKT-TEST/paypal/capture', {
      data: { orderId: 'fake-order', expectedQuoteRevision: 1 },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/portal/tickets/TKT-TEST/paypal/order sin body → 401 o 400', async ({ page }) => {
    const response = await page.request.post('/api/portal/tickets/TKT-TEST/paypal/order', {
      data: {},
    });
    // Sin auth siempre es 401 primero
    expect([400, 401]).toContain(response.status());
  });
});

// ─── Escenario 3: Capture route — validaciones de entrada ────────────────────

test.describe('Capture route — validaciones de cuerpo (sin auth)', () => {
  test('body vacío → 401 (auth evalúa primero)', async ({ page }) => {
    const response = await page.request.post('/api/portal/tickets/TKT-TEST/paypal/capture', {
      data: {},
    });
    expect(response.status()).toBe(401);
  });

  test('orderId como número → 401 (auth evalúa primero que body)', async ({ page }) => {
    const response = await page.request.post('/api/portal/tickets/TKT-TEST/paypal/capture', {
      data: { orderId: 12345, expectedQuoteRevision: 1 },
    });
    expect(response.status()).toBe(401);
  });
});

// ─── Escenario 4: Admin — requestPayment no existe en la UI ──────────────────

test.describe('Admin — requestPayment eliminado de la UI', () => {
  test('página /admin/tickets carga sin errores de JS (smoke)', async ({ page }) => {
    // Captura errores de consola JS (no errores de red — esos son resource errors)
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/admin/tickets', { waitUntil: 'domcontentloaded' });
    // No 500
    expect(response?.status()).not.toBe(500);

    // No debe haber errores fatales de JS (requestPayment undefined, etc.)
    const fatalErrors = consoleErrors.filter(
      (e) =>
        e.includes('requestPayment is not a function') ||
        e.includes('Cannot read properties of undefined'),
    );
    expect(fatalErrors).toHaveLength(0);
  });
});

// ─── Escenario 5: Security — CSRF y IDOR básico ──────────────────────────────

test.describe('Security — CSRF y IDOR básico', () => {
  test('POST /api/portal/tickets con ticket de otro cliente → 401 sin auth', async ({ page }) => {
    const response = await page.request.post(
      '/api/portal/tickets/TKT-OTRO-CLIENTE/paypal/capture',
      {
        data: {
          orderId: 'ORDER-AJENO',
          expectedQuoteRevision: 1,
        },
      },
    );
    // Sin auth → 401
    expect(response.status()).toBe(401);
  });

  test('capture route rechaza content-type no JSON gracefully', async ({ page }) => {
    const response = await page.request.post(
      '/api/portal/tickets/TKT-TEST/paypal/capture',
      {
        headers: { 'Content-Type': 'text/plain' },
        data: 'orderId=fake&expectedQuoteRevision=1',
      },
    );
    // Sin auth → 401 antes de llegar al body parsing
    expect([400, 401]).toContain(response.status());
  });
});

// ─── Escenario 6: Navegación del hub ─────────────────────────────────────────

test.describe('Hub cambios-y-mejoras — navegación básica', () => {
  test('la ruta /cambios-y-mejoras no devuelve 404', async ({ page }) => {
    const response = await page.goto('/cambios-y-mejoras', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).not.toBe(404);
    expect(response?.status()).not.toBe(500);
  });

  test('la meta title de /cambios-y-mejoras no es vacía', async ({ page }) => {
    await page.goto('/cambios-y-mejoras', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
