import { test, expect } from '@playwright/test';
import { tryGetFixtureProjectId, shouldUseAdminAuth, shouldUseClientAuth } from './helpers/fixture-ids';

const FULL_AUTH_E2E = process.env.RUN_AUTH_E2E_FULL === '1';

function skipOrFail(condition: boolean, message: string) {
  if (!condition) return;
  if (FULL_AUTH_E2E) throw new Error(message);
  test.skip(true, message);
}

test.describe('Catalog Commercial - Phase 7 Flujos E2E', () => {
  test.describe('Admin Tests', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'admin', 'Este test solo aplica para el admin (proyecto admin)');
      skipOrFail(!shouldUseAdminAuth(), 'Falta sesion de administrador (admin.json)');
    });

    test('Admin Configuracion carga tab Capacidades & Add-ons', async ({ page }) => {
      await page.goto('/admin/configuracion?tab=addons');
      await expect(page.getByRole('button', { name: /Capacidades & Add-ons/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Total/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Activos/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder(/Buscar por/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('catalog-loading')).toBeHidden({ timeout: 20000 });

      const emptyState = page.getByTestId('catalog-empty-state');
      skipOrFail(await emptyState.isVisible().catch(() => false), 'Catalogo admin vacío — sin datos de seed para validar drawer');

      const firstCard = page.getByTestId('catalog-item-card').first();
      await expect(firstCard).toBeVisible({ timeout: 20000 });

      const cardCount = await page.getByTestId('catalog-item-card').count();
      skipOrFail(cardCount === 0, 'Catalogo admin sin cards disponibles para validar drawer');

      await firstCard.click();
      await expect(page.getByTestId('capability-drawer')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /^Presentacion$/ })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /^Pricing$/ })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /^Reglas \(/ })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /^Uso$/ })).toBeVisible({ timeout: 5000 });
    });

    test('Calculadora admin carga indicadores de catalogo sin crashear', async ({ page }) => {
      await page.goto('/admin/calculadora');
      await expect(page.getByRole('heading', { name: /Calculadora de Cotizaciones/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Componentes/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Resumen en tiempo real/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/La IA analizar/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Cliente Tests', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'cliente', 'Este test solo aplica para clientes (proyecto cliente)');
      skipOrFail(!shouldUseClientAuth(), 'Falta sesion de cliente (client.json)');
    });

    test('Portal solicitudes carga categorias y preview', async ({ page }) => {
      // Verify dashboard loads for this client
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      if (FULL_AUTH_E2E) {
        await expect(page.getByRole('heading', { name: /Hola, QA/i })).toBeVisible({ timeout: 10000 });
      }

      // Navigate directly to the catalog fixture project's solicitudes page.
      // The dashboard picks projects by createdAt ASC; with multiple QA fixtures the wrong
      // project may be selected. Using the fixture ID ensures we always hit the BUSINESS/LIVE
      // project that has QA catalog plan rules configured.
      const catalogProjectId = tryGetFixtureProjectId('catalogLive');
      if (catalogProjectId) {
        await page.goto(`/proyecto/${catalogProjectId}/solicitudes`);
      } else {
        // Fallback: navigate via portal link (pre-fixture behavior)
        await page.goto('/portal');
        await page.waitForLoadState('domcontentloaded');
        const projectLink = page.locator('a[href^="/proyecto/"][href$="/solicitudes"]').first();
        const projectCount = await projectLink.count();
        skipOrFail(projectCount === 0, 'Cliente autenticado no tiene proyectos visibles para validar solicitudes');
        const fallbackHref = await projectLink.getAttribute('href');
        skipOrFail(!fallbackHref, 'Proyecto visible sin href navegable');
        await page.goto(fallbackHref!);
      }
      await expect(page.getByRole('heading', { name: /^Solicitudes$/ })).toBeVisible({ timeout: 10000 });

      const emptyState = page.getByText(/No hay capacidades disponibles/i);
      skipOrFail(await emptyState.isVisible().catch(() => false), 'Proyecto sin capacidades de catalogo disponibles en portal');

      const categoryHeading = page.locator('section h2').first();
      await expect(categoryHeading).toBeVisible({ timeout: 10000 });

      const requestButton = page.getByRole('button', { name: /^Solicitar$/ }).first();
      const requestCount = await requestButton.count();
      skipOrFail(requestCount === 0, 'Catalogo visible, pero sin items solicitables para preview');

      await requestButton.click();
      await expect(page.getByText(/Nueva solicitud/i)).toBeVisible({ timeout: 5000 });
      await page.getByPlaceholder(/Qu[eé] necesitas exactamente/i).fill('Cambio de prueba QA');
      await page.getByPlaceholder(/Describe con detalle/i).fill('Solicitud de validacion E2E del catalogo comercial.');
      await page.getByRole('button', { name: /Ver evaluaci/i }).click();
      await expect(page.getByText(/Esta evaluaci/i).or(page.getByText(/\$0\.00|Con costo|Cotizaci/i)).first()).toBeVisible({ timeout: 10000 });
    });
  });
});
