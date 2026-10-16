/**
 * E2E — shell del portal: contenido real en todos los viewports, menú móvil y robustez.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { shouldUseClientAuth, tryGetFixtureProjectId } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/portal-shell');

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
];

// Strings internas que el cliente nunca debe ver (innerText, no RSC payload).
const FORBIDDEN_STRINGS = [
  '[BRAND_NAME]',
  'YourBrand',
  'WaaS',
  'STAGING_REVIEW',
  'AWAITING_ASSETS',
  'REVISIONS_DONE',
  'PRODUCTION_STARTED',
  'context=portal',
  'context=admin',
  'undefined',
  'NaN',
];

const UUID_RE = /[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/i;

/** Visible text of the page body (skips RSC payload embedded in <script>). */
async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

/** Visible text inside <main> — the actual page content region. */
async function mainText(page: Page): Promise<string> {
  return page.locator('main').first().innerText().catch(() => '');
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `Overflow horizontal en ${label}`).toBeLessThanOrEqual(clientWidth + 2);
}

async function expectNoForbidden(page: Page, label: string) {
  const text = await bodyText(page);
  const url = page.url();
  const hits = FORBIDDEN_STRINGS.filter((s) => text.includes(s) || url.includes(s));
  expect(hits, `Strings internas VISIBLES en ${label}: ${hits.join(', ')}`).toHaveLength(0);
}

/**
 * Exactly one <main> per rendered page — the shell's. Nested <main> (a page
 * wrapping its content in its own <main> inside the shell <main>) is an
 * accessibility violation and the source of the "doble padding" on mobile.
 * Must be asserted BEFORE reading content via main.first().
 */
async function expectSingleMain(page: Page, label: string) {
  await expect(page.locator('main'), `${label}: debe existir exactamente un <main>`).toHaveCount(1);
}

/**
 * The core assertion this block exists to add: <main> must render real, visible
 * content across every viewport — never an empty/black surface.
 */
async function expectMainHasContentAcrossViewports(page: Page, slug: string, minChars = 40) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Poll instead of a fixed wait: after a viewport resize the client may
    // briefly re-render, so a single immediate read can race to 0 chars.
    await expect
      .poll(async () => (await mainText(page)).trim().length, {
        timeout: 5000,
        message: `<main> casi vacío en ${slug} @${vp.name}px — posible pantalla negra`,
      })
      .toBeGreaterThan(minChars);

    await expectNoHorizontalOverflow(page, `${slug} @${vp.name}px`);

    await page.screenshot({
      path: path.join(QA_DIR, `${slug}-${vp.name}.png`),
      fullPage: false,
    });
  }
}

async function gotoOk(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for the streamed page content to replace the Suspense fallback.
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 });
  await expect(page.locator('body')).not.toContainText('hydration failed', { ignoreCase: true });
  await expect(page.locator('body')).not.toContainText('Application error', { ignoreCase: true });
  await expect(page).not.toHaveURL(/acceder/);
  // Guard against nested <main> on every validated route (not just first()).
  await expectSingleMain(page, url);
}

test.describe('Portal Shell: contenido real en todos los viewports', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('dashboard: <main> con contenido, sin overflow, sin strings internas', async ({ page }) => {
    await gotoOk(page, '/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expectNoForbidden(page, '/dashboard');
    await expectMainHasContentAcrossViewports(page, 'dashboard');
  });

  test('soporte: <main> con contenido en mobile y desktop', async ({ page }) => {
    await gotoOk(page, '/soporte');
    await expectNoForbidden(page, '/soporte');
    await expectMainHasContentAcrossViewports(page, 'soporte');
  });

  test('facturacion: <main> con contenido, sin overflow', async ({ page }) => {
    await gotoOk(page, '/facturacion');
    await expectNoForbidden(page, '/facturacion');
    await expectMainHasContentAcrossViewports(page, 'facturacion');
  });

  test('configuracion: <main> con contenido y legible en mobile', async ({ page }) => {
    await gotoOk(page, '/configuracion');
    await expectNoForbidden(page, '/configuracion');
    await expectMainHasContentAcrossViewports(page, 'configuracion');
  });

  test('mi-sitio: <main> con contenido', async ({ page }) => {
    await gotoOk(page, '/mi-sitio');
    await expectNoForbidden(page, '/mi-sitio');
    await expectMainHasContentAcrossViewports(page, 'mi-sitio');
  });

  test('proyecto overview: <main> con contenido y sin UUID crudo visible', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture liveIncidents no disponible');
      return;
    }
    await gotoOk(page, `/proyecto/${projectId}`);

    const visible = await bodyText(page);
    expect(visible.match(UUID_RE)?.[0], 'UUID crudo VISIBLE en /proyecto').toBeUndefined();

    await expectNoForbidden(page, '/proyecto');
    await expectMainHasContentAcrossViewports(page, 'proyecto-overview');
  });
});

test.describe('Menú móvil: abre, navega y cierra (390px)', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('hamburger abre el dialog, muestra nav y cierra con ESC y con botón', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOk(page, '/dashboard');
    // The hamburger onClick needs React hydration — domcontentloaded can fire
    // before JS attaches. Wait for full load so the click actually opens it.
    await page.waitForLoadState('load');

    const hamburger = page.getByTestId('hamburger-btn');
    await expect(hamburger).toBeVisible({ timeout: 10000 });

    // Abrir — reintenta hasta que el dialog aparezca (cubre la carrera de hidratación).
    const dialog = page.locator('[role="dialog"]');
    await expect(async () => {
      await hamburger.click();
      await expect(dialog).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // Nav real dentro del dialog
    const navLink = dialog.locator('a[href="/dashboard"], a[href="/soporte"]').first();
    await expect(navLink).toBeVisible({ timeout: 5000 });

    // Cerrar con ESC
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Reabrir y cerrar con botón "Cerrar menú"
    await hamburger.click();
    await expect(dialog).toBeVisible({ timeout: 8000 });
    await dialog.locator('button[aria-label="Cerrar menú"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('sidebar desktop visible en 1440 (estructura preservada)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoOk(page, '/dashboard');
    const sidebar = page.locator('nav, aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Robustez del shell: sin CDN externo y rutas no disponibles', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  // PASO 4 — el contenido base del portal NO debe depender de scripts externos.
  test('dashboard renderiza el contenido base con todas las requests externas abortadas', async ({
    page,
  }) => {
    // Aborta todo lo que no sea localhost (Clerk CDN, analytics, fuentes externas…).
    // page.request.* no se ve afectado; el SSR usa la cookie de sesión existente.
    await page.route(/^https?:\/\/(?!localhost:|127\.0\.0\.1:)/, (route) => route.abort());

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/acceder/);
    await expect(page.locator('body')).not.toContainText('Application error', { ignoreCase: true });
    await expectSingleMain(page, '/dashboard (sin CDN)');

    // Poll (no single read): the skeleton fallback streams first and is replaced
    // by real SSR content. A single read right after domcontentloaded races to 0.
    await expect
      .poll(async () => (await mainText(page)).trim().length, {
        timeout: 10000,
        message: 'dashboard sin CDN externo dejó <main> vacío — el contenido base depende de un script externo',
      })
      .toBeGreaterThan(40);

    await page.screenshot({ path: path.join(QA_DIR, 'dashboard-no-cdn.png'), fullPage: false });
  });

  // PASO 5 — ruta/proyecto no disponible debe dar salida humana, nunca shell vacío.
  test('proyecto inexistente: salida humana (404 útil / redirección), nunca shell vacío', async ({
    page,
  }) => {
    const fakeProjectId = 'aaaaaaaa-0000-0000-0000-0000000000fa';
    const response = await page.goto(`/proyecto/${fakeProjectId}`, { waitUntil: 'domcontentloaded' });
    const status = response?.status() ?? 0;

    await expect(page.locator('body')).not.toContainText('Application error', { ignoreCase: true });

    // Poll: the inline not-found content streams into the shell <main> after
    // domcontentloaded — a single immediate read races the stream.
    // Salidas humanas válidas: 404 útil, redirección segura, o mensaje claro.
    await expect
      .poll(
        async () => {
          const bodyTxt = await bodyText(page);
          const url = page.url();
          return (
            status === 404 ||
            /\/dashboard|\/acceder/.test(url) ||
            /no existe|no encontrada|404|volver al inicio/i.test(bodyTxt)
          );
        },
        { timeout: 10000, message: `Proyecto inválido sin salida humana (status=${status})` },
      )
      .toBe(true);

    // El shell nunca debe quedar como una pantalla vacía.
    const finalBody = (await bodyText(page)).trim();
    expect(finalBody.length, 'Body vacío en proyecto inválido (shell sin contenido)').toBeGreaterThan(20);

    await page.screenshot({ path: path.join(QA_DIR, 'proyecto-invalido.png'), fullPage: false });
  });
});
