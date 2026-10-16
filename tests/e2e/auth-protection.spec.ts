import { test, expect } from '@playwright/test';

/**
 * Prueba que las rutas protegidas redirigen a /acceder cuando no hay sesión.
 * No requiere credenciales — solo verifica el comportamiento de redirección.
 *
 * Este archivo es la fuente de verdad para protección de rutas en el proyecto no-auth.
 * Todos los tests de protección de este proyecto se centralizan aquí.
 */
test.describe('Protección de rutas', () => {
  // ─── Portal cliente ────────────────────────────────────────

  test('/dashboard redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/onboarding/assets redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/onboarding/assets', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/billing redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/proyecto/[id] redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/proyecto/fake-project-id-test', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/proyecto/[id]/incidencias redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/proyecto/test-id/incidencias', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/proyecto/[id]/staging redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/proyecto/test-uuid-1234/staging', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  // ─── Admin ────────────────────────────────────────────────

  test('/admin redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/admin/proyectos redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin/proyectos', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/admin/calculadora redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin/calculadora', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/admin/incidencias redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin/incidencias', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/admin/feriados redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin/feriados', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  test('/admin/dev redirige a /acceder sin auth', async ({ page }) => {
    await page.goto('/admin/dev', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/acceder/);
  });

  // ─── Rutas públicas ───────────────────────────────────────

  test('/empezar es público — no redirige sin auth', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/acceder|sign-in/);
    await expect(page).toHaveURL(/empezar/);
  });

  test('/empezar/confirmado es público — no redirige sin auth', async ({ page }) => {
    await page.goto('/empezar/confirmado');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/acceder|sign-in/);
    await expect(page).toHaveURL(/confirmado/);
  });

  test('/ redirige a /empezar sin sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/empezar/);
    await expect(page).not.toHaveURL(/acceder|sign-in/);
  });

  // ─── Aliases técnicos Clerk (deben mantenerse funcionales) ────

  test('/sign-in carga la página de Clerk (alias técnico)', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/sign-in/);
    await page.waitForLoadState('domcontentloaded');
    // Clerk renders an email input as the primary entry point
    await expect(
      page.locator('input[type="email"], input[name="identifier"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  // ─── /acceder canónico ────────────────────────────────────

  test('/acceder carga correctamente sin auth', async ({ page }) => {
    await page.goto('/acceder');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/acceder/);
  });

  test('/acceder contiene links de Portal y Panel interno', async ({ page }) => {
    await page.goto('/acceder');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=Portal del cliente').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Panel interno').first()).toBeVisible({ timeout: 8000 });
  });
});
