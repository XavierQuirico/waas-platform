/**
 * E2E — configuración del cliente.
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { shouldUseClientAuth } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/settings');

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
];

const FORBIDDEN_VISIBLE = [
  'Proyecto #',
  'STAGING_REVIEW',
  'AWAITING_ASSETS',
  'context=portal',
  'context=admin',
  'LM04',
  'LM05',
  '[BRAND_NAME]',
  'YourBrand',
  'undefined',
];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function gotoConfig(page: Page) {
  await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 });
  await expect(page).not.toHaveURL(/acceder/);
  await expect(page.locator('main'), 'exactamente un <main>').toHaveCount(1);
  await expect
    .poll(async () => (await page.locator('main').first().innerText().catch(() => '')).trim().length, {
      timeout: 10000,
      message: 'contenido real (no skeleton)',
    })
    .toBeGreaterThan(60);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: sin overflow horizontal (delta=${overflow}px)`).toBeLessThanOrEqual(1);
}

async function assertNoForbiddenCopy(page: Page, label: string) {
  const text = (await page.locator('main').first().innerText().catch(() => '')) || '';
  for (const token of FORBIDDEN_VISIBLE) {
    expect(text, `${label}: no debe contener "${token}"`).not.toContain(token);
  }
  expect(UUID_RE.test(text), `${label}: no debe mostrar UUID crudo`).toBe(false);
}

async function assertMinTapHeight(
  locator: ReturnType<Page['locator']>,
  label: string,
  min = 44,
) {
  const box = await locator.boundingBox();
  expect(box, `${label}: bounding box presente`).not.toBeNull();
  expect(box!.height, `${label}: alto táctil ≥${min}px (got ${box!.height})`).toBeGreaterThanOrEqual(
    min - 0.5,
  );
}

/**
 * Entra en modo edición de una sección. En dev, la isla cliente puede no estar
 * hidratada cuando se hace el primer click; reintentamos click+aserción hasta
 * que el input controlado aparece (la hidratación completa la interactividad).
 */
async function enterEditMode(
  page: Page,
  section: ReturnType<Page['locator']>,
  inputSelector: string,
) {
  await expect(async () => {
    await section.getByRole('button', { name: /^Editar$/ }).click();
    await expect(section.locator(inputSelector)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20000 });
}

test.describe('configuración (cliente autenticado)', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('render real, modo lectura, sin overflow ni tokens + capturas responsive', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoConfig(page);

      const text = await page.locator('main').first().innerText();
      expect(text, `${vp.name}: título Configuración`).toContain('Configuración');
      expect(text, `${vp.name}: sección Cuenta`).toContain('Cuenta');
      expect(text, `${vp.name}: sección Contacto`).toContain('Contacto');
      expect(text, `${vp.name}: sección Negocio`).toContain('Negocio');
      expect(text, `${vp.name}: sección gestionada`).toContain('Gestionado por Xavier');

      // Leyenda de jerarquía: las 3 categorías están presentes.
      expect(text, `${vp.name}: leyenda Editable`).toContain('Editable');
      expect(text, `${vp.name}: leyenda Solo lectura`).toContain('Solo lectura');
      // Panel unificado de datos editables (el título se renderiza en mayúsculas
      // por CSS text-transform; innerText devuelve el texto transformado).
      expect(text.toLowerCase(), `${vp.name}: panel editable`).toContain('datos que puedes editar');

      await assertNoHorizontalOverflow(page, `configuracion-${vp.name}`);
      await assertNoForbiddenCopy(page, `configuracion-${vp.name}`);

      // Modo lectura: hay al menos un botón "Editar" y NO hay inputs visibles aún.
      const editBtn = page.getByRole('button', { name: /^Editar$/ }).first();
      await expect(editBtn).toBeVisible();
      // Inputs hidden (type=hidden, name=__section) no cuentan como editables visibles.
      expect(
        await page.locator('main input:not([type="hidden"])').count(),
        `${vp.name}: sin inputs editables en modo lectura`,
      ).toBe(0);
      // Target táctil ≥44px en mobile.
      if (vp.width <= 430) {
        await assertMinTapHeight(editBtn, `editar-${vp.name}`);
      }

      await page.screenshot({ path: path.join(QA_DIR, `configuracion-${vp.name}.png`), fullPage: false });
    }
  });

  test('edición controlada de Contacto: inputs, guardar deshabilitado sin cambios, cancelar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoConfig(page);

    const contacto = page.locator('section[aria-label="Contacto"]');
    await expect(contacto).toHaveCount(1);

    // Entrar en modo edición de la sección Contacto (robusto a hidratación).
    await enterEditMode(page, contacto, '#cfg-whatsapp');

    // Estado de edición contextual y sobrio.
    await expect(contacto.getByText(/Editando · Contacto/)).toBeVisible();

    // Aparecen inputs controlados con labels.
    const whatsapp = contacto.locator('#cfg-whatsapp');
    await expect(whatsapp).toBeVisible();
    await expect(contacto.locator('label[for="cfg-whatsapp"]')).toHaveCount(1);
    await expect(whatsapp).toHaveAttribute('type', 'tel');
    await assertMinTapHeight(whatsapp, 'input-whatsapp-390');

    // Sin cambios → "Guardar cambios" deshabilitado.
    const save = contacto.getByRole('button', { name: /Guardar cambios/ });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
    await assertMinTapHeight(save, 'guardar-390');

    const cancel = contacto.getByRole('button', { name: /Cancelar/ });
    await assertMinTapHeight(cancel, 'cancelar-390');

    await page.screenshot({ path: path.join(QA_DIR, 'configuracion-edit-390.png'), fullPage: false });

    // Cancelar vuelve a modo lectura (inputs desaparecen).
    await cancel.click();
    await expect(contacto.locator('#cfg-whatsapp')).toHaveCount(0);
    await expect(contacto.getByRole('button', { name: /^Editar$/ })).toBeVisible();
  });

  test('edición Contacto en desktop 1440 + captura', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoConfig(page);

    const contacto = page.locator('section[aria-label="Contacto"]');
    await enterEditMode(page, contacto, '#cfg-location');
    await expect(contacto.locator('#cfg-location')).toBeVisible();

    await page.screenshot({ path: path.join(QA_DIR, 'configuracion-edit-1440.png'), fullPage: false });
  });
});
