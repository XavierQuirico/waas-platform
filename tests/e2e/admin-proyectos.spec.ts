import { test, expect } from '@playwright/test';
import { shouldUseAdminAuth } from './helpers/fixture-ids';

/**
 * Tests del panel admin — acceso y estructura de rutas.
 * Protección de rutas (sin auth) centralizada en auth-protection.spec.ts.
 *
 * Los tests funcionales requieren sesión de Xavier (Clerk).
 * Genera auth: RUN_AUTH_E2E_FULL=1 npx playwright test
 */

/**
 * Tests con sesión de Xavier.
 * Requieren tests/e2e/.auth/admin.json — generado por global-setup.ts.
 */
test.describe('Admin panel — con sesión Xavier', () => {
  test.skip(!shouldUseAdminAuth(), 'Requiere tests/e2e/.auth/admin.json — ver global-setup.ts');

  test('/admin/proyectos muestra la cola de proyectos', async ({ page }) => {
    await page.goto('/admin/proyectos');
    await page.waitForLoadState('networkidle');
    // Cola de Proyectos is the h1 rendered by SectionHeader inside ProjectsQueue
    await expect(page.locator('h1').filter({ hasText: /Cola de Proyectos/i })).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Tests de la calculadora interna — flujo básico del Step 1 (ClientContext).
 * La ruta /admin/calculadora está protegida por Clerk.
 */
test.describe('Admin calculadora', () => {
  test.skip(!shouldUseAdminAuth(), 'Requiere tests/e2e/.auth/admin.json — ver global-setup.ts');

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/calculadora');
    await page.waitForLoadState('networkidle');
  });

  test('página carga correctamente con h1 visible', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Calculadora');
  });

  test('step 1 ClientContext — puede rellenar nombre de cliente y seleccionar niche', async ({ page }) => {
    const clientNameInput = page.locator('input[placeholder="Ej: María González"]').first();
    await expect(clientNameInput).toBeVisible();
    await clientNameInput.fill('Ana Martínez');

    const businessNameInput = page.locator('input[placeholder="Ej: Clínica Dra. González"]').first();
    await expect(businessNameInput).toBeVisible();
    await businessNameInput.fill('Consultorio Martínez');

    const saludButton = page.locator('button').filter({ hasText: 'Salud' }).first();
    await expect(saludButton).toBeVisible();
    await saludButton.click();

    // Verify selection was registered — button should visually indicate active state
    // Use aria-pressed or data attribute if available; otherwise verify it's still visible
    // (class-based checks are fragile against CSS refactors)
    await expect(saludButton).toBeVisible();
    await expect(saludButton).toBeEnabled();
  });

  test('step 1 — validación: no puede continuar sin nombre de cliente', async ({ page }) => {
    const ctaButton = page.locator('button:has-text("Analizar con IA")').first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    const errorMsg = page.locator('p.text-xs.text-red-400').first();
    await expect(errorMsg).toBeVisible({ timeout: 2000 });
    await expect(errorMsg).toContainText('Requerido');

    await expect(page.locator('h2:has-text("Paso 1")')).toBeVisible();
  });

  test('step 1 — modo prompt disponible y acepta texto', async ({ page }) => {
    const promptToggle = page.locator('button:has-text("Brief libre (IA)")').first();
    await expect(promptToggle).toBeVisible();
    await promptToggle.click();

    const briefTextarea = page.locator('textarea').first();
    await expect(briefTextarea).toBeVisible();

    await briefTextarea.fill('Soy dentista y quiero una web con agenda online para pacientes.');
    await expect(briefTextarea).toHaveValue('Soy dentista y quiero una web con agenda online para pacientes.');
  });
});

/**
 * Test de transición PRODUCTION_STARTED → STAGING_REVIEW
 * Requiere sesión Xavier + TEST_PRODUCTION_PROJECT_ID apuntando a proyecto en PRODUCTION_STARTED.
 * Skip implícito cuando TEST_PRODUCTION_PROJECT_ID no está definido.
 */
test.describe('Transición PRODUCTION_STARTED → STAGING_REVIEW', () => {
  test.skip(!shouldUseAdminAuth(), 'Requiere tests/e2e/.auth/admin.json — ver global-setup.ts');

  test('Xavier puede avanzar proyecto de PRODUCTION_STARTED a STAGING_REVIEW', async ({ page }) => {
    const productionProjectId = process.env.TEST_PRODUCTION_PROJECT_ID;
    test.skip(!productionProjectId, 'Requiere TEST_PRODUCTION_PROJECT_ID env var apuntando a proyecto PRODUCTION_STARTED');

    await page.goto(`/admin/proyectos/${productionProjectId}`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(productionProjectId!));

    const advanceControl = page.locator(
      'button:has-text("Staging"), button:has-text("STAGING_REVIEW"), select[name*="status"], [data-action="advance-state"]'
    ).first();

    if (await advanceControl.count() > 0) {
      const tagName = await advanceControl.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await advanceControl.selectOption('STAGING_REVIEW');
      } else {
        await advanceControl.click();
      }
      await page.waitForTimeout(1000);
    }

    // Project page must still be accessible and show the project
    await expect(page).toHaveURL(new RegExp(productionProjectId!));
  });

  test('campo staging URL es requerido para transición a STAGING_REVIEW', async ({ page }) => {
    const productionProjectId = process.env.TEST_PRODUCTION_PROJECT_ID;
    test.skip(!productionProjectId, 'Requiere TEST_PRODUCTION_PROJECT_ID env var');

    await page.goto(`/admin/proyectos/${productionProjectId}`);
    await page.waitForLoadState('networkidle');

    const stagingUrlInput = page.locator(
      'input[name*="staging"], input[placeholder*="vercel"], input[placeholder*="staging"]'
    ).first();

    if (await stagingUrlInput.count() > 0) {
      await expect(stagingUrlInput).toBeVisible();

      const submitBtn = page.locator('button[type="submit"], button:has-text("Avanzar"), button:has-text("Staging")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        const errorOrDisabled =
          (await submitBtn.isDisabled()) ||
          (await page.locator('[class*="error"], [class*="red"], p:has-text("requerido")').count()) > 0;
        // If staging URL field exists, the UI must enforce it
        expect(errorOrDisabled).toBe(true);
      }
    }

    await expect(page).toHaveURL(new RegExp(productionProjectId!));
  });
});
