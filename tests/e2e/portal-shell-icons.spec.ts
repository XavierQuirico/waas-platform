/**
 * E2E — iconografía del shell móvil. Requiere PLAYWRIGHT_USE_EXISTING_AUTH=1.
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { shouldUseClientAuth } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/portal-shell-icons');

async function gotoOk(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 });
  await expect(page).not.toHaveURL(/acceder/);
  await expect(page.locator('main'), `${url}: exactamente un <main>`).toHaveCount(1);
}

test.describe('Evidencia visual: iconografía lucide en el shell móvil', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('dashboard: capturas en 390/430/768/1440 con iconos unificados', async ({ page }) => {
    await gotoOk(page, '/dashboard');
    for (const vp of [
      { name: '390', width: 390, height: 844 },
      { name: '430', width: 430, height: 932 },
      { name: '768', width: 768, height: 1024 },
      { name: '1440', width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect
        .poll(async () => (await page.locator('main').first().innerText().catch(() => '')).trim().length, {
          timeout: 5000,
        })
        .toBeGreaterThan(40);
      await page.screenshot({ path: path.join(QA_DIR, `dashboard-${vp.name}.png`), fullPage: false });
    }
  });

  test('facturacion: capturas en 390/1440', async ({ page }) => {
    for (const vp of [
      { name: '390', width: 390, height: 844 },
      { name: '1440', width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, '/facturacion');
      await expect
        .poll(async () => (await page.locator('main').first().innerText().catch(() => '')).trim().length, {
          timeout: 10000,
        })
        .toBeGreaterThan(80);
      await page.screenshot({ path: path.join(QA_DIR, `facturacion-${vp.name}.png`), fullPage: false });
    }
  });

  test('menu hamburger: abre y captura en 390/430 (topbar Menu + dialog X/iconos lucide)', async ({ page }) => {
    for (const vp of [
      { name: '390', width: 390, height: 844 },
      { name: '430', width: 430, height: 932 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, '/dashboard');
      await page.waitForLoadState('load');

      const hamburger = page.getByTestId('hamburger-btn');
      await expect(hamburger).toBeVisible({ timeout: 10000 });
      // El hamburger expone el contrato de accesibilidad nuevo.
      await expect(hamburger).toHaveAttribute('aria-controls', 'portal-mobile-menu');

      const dialog = page.locator('[role="dialog"]');
      await expect(async () => {
        await hamburger.click();
        await expect(dialog).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15000 });

      // El dialog enlaza con aria-controls del hamburger.
      await expect(dialog).toHaveAttribute('id', 'portal-mobile-menu');
      // Esperar a que el fadeInSlide (0.2s) asiente para una captura opaca limpia.
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(QA_DIR, `menu-open-${vp.name}.png`), fullPage: false });

      await dialog.locator('button[aria-label="Cerrar menú"]').click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });
});
