/**
 * E2E — administrador: acceso a rutas de admin y aislamiento básico.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { shouldUseAdminAuth } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/admin-isolation');

// ─── GRUPO ADMIN — AISLAMIENTO BÁSICO ─────────────────────────────────────

test.describe('Admin Aislamiento Básico (Xavier)', () => {
  test.skip(!shouldUseAdminAuth(), 'Requiere tests/e2e/.auth/admin.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1');

  test('/admin carga correctamente con sesión admin', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    // Admin debe cargar sin redirigir a /acceder ni loop
    const url = page.url();
    await expect(page).not.toHaveURL(/acceder/);
    await expect(page.locator('body')).not.toContainText('hydration failed', { ignoreCase: true });
    await expect(page.locator('body')).not.toContainText('Application error', { ignoreCase: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(QA_DIR, 'admin-access-1440.png'), fullPage: false });
    console.log(`Admin access OK: ${url}`);
  });

  test('/acceder/resolver con admin redirige a /admin', async ({ page }) => {
    await page.goto('/acceder/resolver', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    // Con admin debe ir a /admin (o ruta dentro de /admin)
    expect(url, `resolver con admin fue a ${url} — esperado /admin`).toContain('/admin');
    await page.screenshot({ path: path.join(QA_DIR, 'admin-resolver-1440.png'), fullPage: false });
  });

  test('admin no termina en /acceder al intentar /admin', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/acceder/);
  });
});
