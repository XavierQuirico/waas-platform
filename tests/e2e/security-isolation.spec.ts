import { test, expect } from '@playwright/test';
import { tryGetFixtureProjectId, shouldUseClientAuth } from './helpers/fixture-ids';

/**
 * Tests de aislamiento de datos entre clientes.
 * Verifica que un cliente no puede acceder a proyectos ajenos
 * ni via navegación directa ni via API tRPC.
 *
 * Protección sin auth centralizada en auth-protection.spec.ts.
 *
 * Con auth (cliente principal): accede a proyecto del cliente secundario.
 * Fixture: qa-other-client-project.test — pertenece al cliente secundario, nunca al principal.
 */
test.describe('Aislamiento de datos — con sesión cliente', () => {
  test.skip(!shouldUseClientAuth(), 'Requiere tests/e2e/.auth/client.json — ver global-setup.ts');

  test('cliente no puede acceder a proyecto de otro cliente', async ({ page }) => {
    const otherProjectId = tryGetFixtureProjectId('otherClient');
    if (!otherProjectId) {
      test.skip(true, 'Fixture qa-other-client-project.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    await page.goto(`/proyecto/${otherProjectId}/assets`);
    await expect(page.locator('body')).not.toBeEmpty();

    const currentUrl = page.url();
    const isRedirected =
      /dashboard|sign-in|403|404/.test(currentUrl) ||
      !currentUrl.includes(otherProjectId);

    if (!isRedirected) {
      const bodyText = await page.textContent('body');
      const hasErrorMessage =
        bodyText?.includes('No autorizado') ||
        bodyText?.includes('Acceso denegado') ||
        bodyText?.includes('Not found') ||
        bodyText?.includes('No tienes acceso') ||
        bodyText?.includes('404');
      expect(hasErrorMessage).toBe(true);
    } else {
      expect(isRedirected).toBe(true);
    }
  });

  test('API tRPC project.getById rechaza proyecto de otro cliente', async ({ page }) => {
    const otherProjectId = tryGetFixtureProjectId('otherClient');
    if (!otherProjectId) {
      test.skip(true, 'Fixture qa-other-client-project.test no encontrado. Ejecutar: npm run seed:e2e-auth');
      return;
    }

    const response = await page.request.fetch(
      `/api/trpc/project.getById?input={"json":{"projectId":"${otherProjectId}"}}`
    );

    const status = response.status();

    if (status === 401 || status === 403) {
      expect([401, 403]).toContain(status);
    } else if (status === 200) {
      const json = await response.json();
      const hasError =
        json?.result?.error != null ||
        json?.error != null ||
        json?.result?.data == null;
      expect(hasError).toBe(true);
    } else {
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });
});
