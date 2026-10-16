import { test, expect } from '@playwright/test';
import { tryGetFixtureProjectId, shouldUseClientAuth } from './helpers/fixture-ids';

/**
 * Tests del flujo de revisión de staging.
 *
 * Protección sin auth centralizada en auth-protection.spec.ts.
 *
 * Con auth + fixture qa-staging-review.test (STAGING_REVIEW):
 * Fixture creado por: npm run seed:e2e-auth
 */
test.describe('Staging review — con sesión', () => {
  test.skip(!shouldUseClientAuth(), 'Requiere tests/e2e/.auth/client.json — ver global-setup.ts');

  test('muestra formulario de feedback estructurado con h1 correcto', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('stagingReview');
    if (!projectId) {
      test.skip(true, 'Fixture qa-staging-review.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/staging`);
    await expect(page).toHaveURL(new RegExp(`proyecto/${projectId}/staging`));

    // StagingReviewPage renders h1 "Revisa tu sitio"
    await expect(
      page.getByRole('heading', { name: /Revisa tu sitio/i })
    ).toBeVisible({ timeout: 10000 });

    // Feedback form: textarea + action buttons
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();

    // Must have at least the approve button
    const approveBtn = page.locator(
      'button:has-text("Aprobar"), button:has-text("go-live"), button:has-text("Solicitar revisión")'
    ).first();
    await expect(approveBtn).toBeVisible();
  });

  test('muestra el número de revisión en el badge', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('stagingReview');
    if (!projectId) {
      test.skip(true, 'Fixture qa-staging-review.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/staging`);
    await expect(
      page.getByRole('heading', { name: /Revisa tu sitio/i })
    ).toBeVisible({ timeout: 10000 });

    // Badge showing "Revisión #N" must be present for a staging review fixture
    const revisionBadge = page.locator(
      'text=/Revisión #\\d+|Revisión \\d+|Rev\\. \\d+/i'
    ).first();
    await expect(revisionBadge).toBeVisible({ timeout: 5000 });
  });

  test('feedback con cambios requiere comentario antes de enviar', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('stagingReview');
    if (!projectId) {
      test.skip(true, 'Fixture qa-staging-review.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/staging`);
    await expect(
      page.getByRole('heading', { name: /Revisa tu sitio/i })
    ).toBeVisible({ timeout: 10000 });

    const revisionBtn = page.locator('button:has-text("Solicitar revisión")').first();
    if (await revisionBtn.count() === 0) {
      test.skip(true, 'Botón "Solicitar revisión" no encontrado — fixture puede estar en estado incorrecto');
      return;
    }

    // Without feedback text, the button must be disabled
    await expect(revisionBtn).toBeDisabled();

    // Short text (< 10 chars) — button should remain disabled
    const textarea = page.locator('textarea').first();
    await textarea.fill('corto');
    await expect(revisionBtn).toBeDisabled();

    expect(page.url()).toContain('staging');
  });

  test('botón de aprobación está habilitado sin requerir comentario', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('stagingReview');
    if (!projectId) {
      test.skip(true, 'Fixture qa-staging-review.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${projectId}/staging`);
    await expect(
      page.getByRole('heading', { name: /Revisa tu sitio/i })
    ).toBeVisible({ timeout: 10000 });

    // Approval button should be enabled without any feedback (no comment required for approval)
    const approveBtn = page.locator(
      'button:has-text("Aprobar staging"), button:has-text("go-live")'
    ).first();
    if (await approveBtn.count() === 0) {
      test.skip(true, 'Botón de aprobación no encontrado — fixture puede estar ya aprobado o en estado diferente');
      return;
    }

    await expect(approveBtn).toBeEnabled();
  });
});
