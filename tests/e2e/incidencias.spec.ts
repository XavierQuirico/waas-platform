import { test, expect } from '@playwright/test';
import { tryGetFixtureProjectId, shouldUseClientAuth } from './helpers/fixture-ids';

/**
 * Tests de incidencias — cliente autenticado.
 *
 * Protección de rutas sin auth centralizada en auth-protection.spec.ts.
 *
 * Tests con sesión requieren:
 *   - tests/e2e/.auth/client.json (generado por global-setup.ts)
 *   - Fixture qa-live-incidents.test (LIVE) creado por npm run seed:e2e-auth
 */

test.describe('Incidencias — flujo cliente con sesión', () => {
  test.skip(!shouldUseClientAuth(), 'Requiere tests/e2e/.auth/client.json — ver global-setup.ts');

  test('página de incidencias carga correctamente', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture qa-live-incidents.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/incidencias`);
    await expect(page).toHaveURL(new RegExp(`proyecto/${projectId}/incidencias`));
    // The incidencias page renders an h2 with text "Incidencias"
    await expect(
      page.getByRole('heading', { name: /Incidencias/i })
    ).toBeVisible({ timeout: 25000 });
  });

  test('puede ver la lista de incidencias o estado vacío', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture qa-live-incidents.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/incidencias`);
    await expect(
      page.getByRole('heading', { name: /Incidencias/i })
    ).toBeVisible({ timeout: 25000 });

    // Fixture seeds at least one incident — list items should be present
    const incidentItems = page.locator('[class*="incident"], [class*="issue"]');
    const emptyMsg = page.locator('text=/no hay|sin incidencias|todo funciona|0 incidencias/i');

    const hasItems = (await incidentItems.count()) > 0;
    const hasEmpty = (await emptyMsg.count()) > 0;
    expect(hasItems || hasEmpty).toBe(true);
  });

  test('puede abrir el formulario para reportar incidencia', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture qa-live-incidents.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/incidencias`);
    await expect(
      page.getByRole('heading', { name: /Incidencias/i })
    ).toBeVisible({ timeout: 25000 });

    // Button text in the page is "Reportar problema"
    const reportBtn = page.locator(
      'button:has-text("Reportar"), button:has-text("problema")'
    ).first();
    await expect(reportBtn).toBeVisible({ timeout: 5000 });

    await reportBtn.click();
    await page.waitForTimeout(300);

    // Form renders with a title input
    const titleInput = page.locator(
      'input[placeholder*="Título"], input[placeholder*="problema"]'
    ).first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });
  });

  test('formulario tiene campos de título y selector de prioridad', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture qa-live-incidents.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/incidencias`);
    await expect(
      page.getByRole('heading', { name: /Incidencias/i })
    ).toBeVisible({ timeout: 25000 });

    const reportBtn = page.locator(
      'button:has-text("Reportar"), button:has-text("problema")'
    ).first();
    await expect(reportBtn).toBeVisible({ timeout: 5000 });
    await reportBtn.click();
    await page.waitForTimeout(300);

    const titleInput = page.locator(
      'input[placeholder*="Título"], input[placeholder*="título"], input[placeholder*="sitio"]'
    ).first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    // Priority selector must be present ("Normal" or "Urgente" buttons)
    const prioritySelector = page.locator(
      'button:has-text("Normal"), button:has-text("Urgente"), input[name="priority"]'
    ).first();
    await expect(prioritySelector).toBeVisible({ timeout: 3000 });
  });

  test('puede reportar una incidencia y recibe confirmación', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('liveIncidents');
    if (!projectId) {
      test.skip(true, 'Fixture qa-live-incidents.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/incidencias`);
    await expect(
      page.getByRole('heading', { name: /Incidencias/i })
    ).toBeVisible({ timeout: 25000 });

    const reportBtn = page.locator(
      'button:has-text("Reportar"), button:has-text("problema")'
    ).first();
    await expect(reportBtn).toBeVisible({ timeout: 5000 });
    await reportBtn.click();
    await page.waitForTimeout(300);

    const titleInput = page.locator(
      'input[placeholder*="Título"], input[placeholder*="sitio"], input[placeholder*="problema"]'
    ).first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });

    const testTitle = `Test incidencia E2E ${Date.now()}`;
    await titleInput.fill(testTitle);
    await expect(titleInput).toHaveValue(new RegExp('Test incidencia E2E'));

    const normalBtn = page.locator('button:has-text("Normal")').first();
    if (await normalBtn.count() > 0) await normalBtn.click();

    const submitBtn = page.locator('button:has-text("Enviar reporte")').first();
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    // After submit: either the form closes (reportBtn reappears) or a success message appears
    await page.waitForTimeout(3000);
    const formClosed = (await page.locator('button:has-text("Reportar"), button:has-text("problema")').count()) > 0 &&
      (await page.locator('input[placeholder*="Título"], input[placeholder*="sitio"]').count()) === 0;
    const successMsg = (await page.locator(
      'text=/enviado|registrado|gracias|incidencia creada/i'
    ).count()) > 0;

    expect(formClosed || successMsg).toBe(true);
  });
});
