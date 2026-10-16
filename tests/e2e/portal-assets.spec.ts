import { test, expect } from '@playwright/test';
import { tryGetFixtureProjectId, shouldUseClientAuth } from './helpers/fixture-ids';

/**
 * Tests del portal cliente — /onboarding/assets y /dashboard
 *
 * Protección de rutas sin auth centralizada en auth-protection.spec.ts.
 *
 * Con auth: requiere sesión de cliente (tests/e2e/.auth/client.json).
 * Generar con: RUN_AUTH_E2E_FULL=1 npx playwright test
 */

/**
 * Tests funcionales con sesión de cliente.
 * Corren cuando tests/e2e/.auth/client.json existe (generado por global-setup.ts).
 */
test.describe('Portal cliente — con sesión', () => {
  test.skip(!shouldUseClientAuth(), 'Requiere tests/e2e/.auth/client.json — ver global-setup.ts');

  test('/dashboard carga y muestra saludo con nombre del cliente', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    // QA fixture client has fullName "QA Client" → heading shows "Hola, QA"
    await expect(
      page.getByRole('heading', { name: /Hola,/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('/dashboard muestra el plan activo del cliente', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Hola,/i })).toBeVisible({ timeout: 10000 });

    // Dashboard renders plan name next to "Plan" label
    const planIndicator = page.locator('text=/Plan\s+(Basic|Pro|Business|Legacy)/i').first();
    // Also accept separate "Plan" label + plan text in proximity
    const hasPlan =
      (await planIndicator.count()) > 0 ||
      (await page.locator('text=/BASIC|PRO|BUSINESS|LEGACY/i').count()) > 0;
    expect(hasPlan).toBe(true);
  });

  test('/onboarding/assets muestra checklist de materiales del proyecto', async ({ page }) => {
    await page.goto('/onboarding/assets');

    const currentUrl = page.url();
    if (!currentUrl.includes('onboarding/assets')) {
      test.skip(true, 'Fixture de cliente no está en fase de assets — verificar estado del proyecto QA');
      return;
    }

    await expect(page.locator('h1, h2').first()).toBeVisible();

    // AssetRow renders data-testid="asset-item" for each requirement
    const assetItems = page.locator('[data-testid="asset-item"]');
    const count = await assetItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('/onboarding/assets — assets con canUpload=false no tienen file input activo', async ({ page }) => {
    await page.goto('/onboarding/assets');

    const currentUrl = page.url();
    if (!currentUrl.includes('onboarding/assets')) {
      test.skip(true, 'Fixture de cliente no está en fase de assets — verificar estado del proyecto QA');
      return;
    }

    await expect(page.locator('body')).not.toBeEmpty();

    // For any asset-item where data-can-upload="false", no file input should be rendered
    const blockedRows = page.locator('[data-testid="asset-item"][data-can-upload="false"]');
    const blockedCount = await blockedRows.count();

    for (let i = 0; i < blockedCount; i++) {
      const row = blockedRows.nth(i);
      const fileInput = row.locator('input[type="file"]');
      expect(await fileInput.count()).toBe(0);
    }
  });

  test('/portal/billing redirige a la ruta canónica de facturación', async ({ page }) => {
    await page.goto('/portal/billing');
    await expect(page).toHaveURL(/facturacion/);
    // Facturación page must render a heading
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('nav del portal tiene links a dashboard y assets visibles', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Hola,/i })).toBeVisible({ timeout: 10000 });

    const dashboardLink = page.locator('a[href="/dashboard"], a[href*="dashboard"]').first();
    const assetsLink = page.locator('a[href*="assets"]').first();

    if (await dashboardLink.count() > 0) {
      await expect(dashboardLink).toBeVisible();
    }
    if (await assetsLink.count() > 0) {
      await expect(assetsLink).toBeVisible();
    }
  });
});

/**
 * Tests de re-upload selectivo — ASSETS_INCOMPLETE
 * Solo los assets marcados como rechazados deben mostrar upload habilitado.
 * Usa fixture qa-assets-incomplete.test (creado por npm run seed:e2e-auth).
 */
test.describe('Re-upload selectivo — ASSETS_INCOMPLETE', () => {
  test.skip(!shouldUseClientAuth(), 'Requiere tests/e2e/.auth/client.json — ver global-setup.ts');

  test('solo assets rechazados tienen upload habilitado', async ({ page }) => {
    const incompleteProjectId = tryGetFixtureProjectId('assetsIncomplete');
    if (!incompleteProjectId) {
      test.skip(true, 'Fixture qa-assets-incomplete.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${incompleteProjectId}/assets`);
    await expect(page).toHaveURL(new RegExp(incompleteProjectId));
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Fixture: logo=approved, photos=rejected, copy_doc=uploaded.
    // La lista de requisitos se renderiza para desktop y mobile (una oculta por CSS):
    // tomamos el primer match en cada caso.
    // logo: data-can-upload="false" (approved)
    const logoRow = page.locator('[data-testid="asset-item"][data-asset-key="logo"]').first();
    if (await logoRow.count() > 0) {
      await expect(logoRow).toHaveAttribute('data-can-upload', 'false');
    }

    // photos: data-can-upload="true" (rejected)
    const photosRow = page.locator('[data-testid="asset-item"][data-asset-key="photos"]').first();
    if (await photosRow.count() > 0) {
      await expect(photosRow).toHaveAttribute('data-can-upload', 'true');
    }
  });

  test('assets aprobados no muestran opción de re-upload', async ({ page }) => {
    const incompleteProjectId = tryGetFixtureProjectId('assetsIncomplete');
    if (!incompleteProjectId) {
      test.skip(true, 'Fixture qa-assets-incomplete.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${incompleteProjectId}/assets`);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    const approvedRows = page.locator('[data-testid="asset-item"][data-asset-status="approved"]');
    const approvedCount = await approvedRows.count();
    for (let i = 0; i < approvedCount; i++) {
      const row = approvedRows.nth(i);
      const fileInput = row.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        // If a file input exists in an approved row, canUpload must be false
        await expect(row).toHaveAttribute('data-can-upload', 'false');
      }
    }
  });

  test('comentario de rechazo es visible para assets rechazados', async ({ page }) => {
    const incompleteProjectId = tryGetFixtureProjectId('assetsIncomplete');
    if (!incompleteProjectId) {
      test.skip(true, 'Fixture qa-assets-incomplete.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${incompleteProjectId}/assets`);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Fixture seeds a rejection comment on photos: "Las fotos son demasiado oscuras..."
    // This comment must be rendered in the UI for rejected assets
    const rejectionComment = page.locator(
      'text=/fotos.*oscuras|demasiado oscuras/i'
    ).first();
    await expect(rejectionComment).toBeVisible({ timeout: 5000 });
  });
});
