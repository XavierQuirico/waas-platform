/**
 * E2E — dashboard del cliente: etiquetas legibles y comportamiento responsive.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { shouldUseClientAuth } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/dashboard');

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
];

// Labels internos que el cliente NUNCA debe ver.
const FORBIDDEN_STRINGS = [
  'Proyecto #',
  'STAGING_REVIEW',
  'AWAITING_ASSETS',
  'REVISIONS_DONE',
  'PRODUCTION_STARTED',
  'ASSETS_INCOMPLETE',
  'projectId',
  'clientId',
  'undefined',
  'null',
  'NaN',
];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

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
  const hits = FORBIDDEN_STRINGS.filter((s) => text.includes(s));
  expect(hits, `Labels internos VISIBLES en ${label}: ${hits.join(', ')}`).toHaveLength(0);
}

async function expectNoVisibleUuid(page: Page, label: string) {
  const text = await bodyText(page);
  expect(text.match(UUID_RE)?.[0], `UUID crudo VISIBLE en ${label}`).toBeUndefined();
}

async function gotoOk(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 });
  await expect(page).not.toHaveURL(/acceder/);
  await expect(page.locator('main'), `${url}: exactamente un <main>`).toHaveCount(1);
}

test.describe('Dashboard: labels humanos y polish responsive', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('dashboard: sin "Proyecto #", sin UUID, sin estados técnicos', async ({ page }) => {
    await gotoOk(page, '/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expectNoForbidden(page, '/dashboard');
    await expectNoVisibleUuid(page, '/dashboard');
  });

  test('dashboard: contenido real y sin overflow en todos los viewports', async ({ page }) => {
    await gotoOk(page, '/dashboard');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect
        .poll(async () => (await mainText(page)).trim().length, {
          timeout: 5000,
          message: `<main> casi vacío en dashboard @${vp.name}px`,
        })
        .toBeGreaterThan(40);
      await expectNoHorizontalOverflow(page, `dashboard @${vp.name}px`);
      await page.screenshot({
        path: path.join(QA_DIR, `dashboard-${vp.name}.png`),
        fullPage: false,
      });
    }
  });

  test('dashboard: la status card mantiene un CTA útil', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoOk(page, '/dashboard');
    const main = page.locator('main').first();
    // Debe existir al menos un enlace o botón accionable en la zona principal.
    const actionable = main.locator('a[href], button');
    await expect(actionable.first()).toBeVisible({ timeout: 10000 });
    expect(await actionable.count()).toBeGreaterThan(0);
  });

  test('facturacion: sin "Proyecto #" ni UUID visible, contenido real (no skeleton)', async ({ page }) => {
    // Señales de contenido real renderizado (no skeleton/loading) en /facturacion.
    const REAL_SIGNALS = [
      'Facturación',
      'Plan activo',
      'Solicitudes cobrables',
      'Historial de pagos',
      'Proyectos (',
      'Consulta tu plan',
      'Sin proyecto activo',
    ];
    for (const vp of [
      { name: '390', width: 390, height: 844 },
      { name: '430', width: 430, height: 932 },
      { name: '1440', width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, '/facturacion');

      // Esperar a que el contenido real reemplace al skeleton de Suspense.
      await expect
        .poll(
          async () => {
            const txt = (await mainText(page)).trim();
            const hasSignal = REAL_SIGNALS.some((s) => txt.includes(s));
            return hasSignal && txt.length > 80;
          },
          {
            timeout: 10000,
            message: `/facturacion @${vp.name}px quedó en skeleton — sin contenido real`,
          },
        )
        .toBe(true);

      await expectNoForbidden(page, `/facturacion @${vp.name}px`);
      await expectNoVisibleUuid(page, `/facturacion @${vp.name}px`);
      await expectNoHorizontalOverflow(page, `facturacion @${vp.name}px`);
      await page.screenshot({
        path: path.join(QA_DIR, `facturacion-${vp.name}.png`),
        fullPage: false,
      });
    }
  });
});
