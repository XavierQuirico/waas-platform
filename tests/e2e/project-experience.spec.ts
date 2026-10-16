/**
 * E2E — proyecto, materiales, documentos y revisión de staging.
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { shouldUseClientAuth, tryGetFixtureProjectId } from './helpers/fixture-ids';

const QA_DIR = path.resolve(process.cwd(), 'output/screenshots/project-experience');

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
  'ASSETS_INCOMPLETE',
  'PRODUCTION_STARTED',
  'context=portal',
  'context=admin',
  'LM04',
  'LM05',
];

// Raw v4 UUID anywhere in visible copy is a leak.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

async function gotoOk(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor({ state: 'attached', timeout: 15000 });
  await expect(page).not.toHaveURL(/acceder/);
  await expect(page.locator('main'), `${url}: exactamente un <main>`).toHaveCount(1);
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

/**
 * Espera contenido REAL en <main> antes de capturar — evita screenshots del
 * RouteSkeletonGate (skeleton sin copy). Exige (a) una señal de copy humano de
 * la ruta y (b) que el texto visible tenga longitud suficiente. Si el skeleton
 * nunca es reemplazado, falla en vez de capturar evidencia falsa.
 */
async function waitForRealContent(page: Page, signal: RegExp, label: string, min = 80) {
  await expect
    .poll(
      async () => {
        const text = ((await page.locator('main').first().innerText().catch(() => '')) || '').trim();
        return signal.test(text) && text.length >= min ? text.length : 0;
      },
      { timeout: 12000, message: `${label}: contenido real renderizado (no skeleton)` },
    )
    .toBeGreaterThanOrEqual(min);
}

// Copys humanos que sólo existen cuando la pantalla de staging renderizó de verdad.
const STAGING_REAL_SIGNAL =
  /Revisa tu preview|Preview listo|Aprobaci[oó]n|Feedback enviado|aplicando tus cambios|Revisiones|Tu sitio ya está publicado|Proyecto entregado|Preview no disponible|Cambios que quieres solicitar|Aprobar preview|Abrir preview/i;

// Copys humanos que sólo existen cuando el paquete de materiales renderizó de verdad.
const ASSETS_REAL_SIGNAL =
  /Paquete de materiales|requeridos listos|Requeridos|Requerido|Pendiente|Arrastra aquí|Buscar archivo/i;

test.describe('experiencia de proyecto (cliente autenticado)', () => {
  test.skip(
    !shouldUseClientAuth(),
    'Requiere tests/e2e/.auth/client.json — activar con PLAYWRIGHT_USE_EXISTING_AUTH=1 o RUN_AUTH_E2E_FULL=1',
  );

  test('overview: render real, un <main>, sin overflow ni tokens técnicos + capturas', async ({ page }) => {
    const projectId =
      tryGetFixtureProjectId('catalogLive') ?? tryGetFixtureProjectId('stagingReview');
    test.skip(!projectId, 'Sin fixture de proyecto (npm run seed:e2e-auth)');

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, `/proyecto/${projectId}`);
      await expect
        .poll(async () => (await page.locator('main').first().innerText().catch(() => '')).trim().length, {
          timeout: 8000,
        })
        .toBeGreaterThan(60);
      await assertNoHorizontalOverflow(page, `overview-${vp.name}`);
      await assertNoForbiddenCopy(page, `overview-${vp.name}`);
      await page.screenshot({ path: path.join(QA_DIR, `project-overview-${vp.name}.png`), fullPage: false });
    }
  });

  test('overview: sección Documentos muestra empty state humano sin botones muertos', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('catalogLive');
    test.skip(!projectId, 'Sin fixture de proyecto');
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoOk(page, `/proyecto/${projectId}`);

    const docs = page.locator('section[aria-label="Documentos"]');
    await expect(docs).toHaveCount(1);
    // No botones ni links muertos dentro del empty state.
    await expect(docs.locator('a, button')).toHaveCount(0);
    await page.screenshot({ path: path.join(QA_DIR, 'documents-empty-390.png'), fullPage: false });
  });

  test('staging: preview seguro + textarea con label + submit no vacío', async ({ page }) => {
    const projectId = tryGetFixtureProjectId('stagingReview');
    test.skip(!projectId, 'Sin fixture stagingReview');

    for (const vp of [VIEWPORTS[0], VIEWPORTS[4]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, `/proyecto/${projectId}/staging`);
      // Gate anti-skeleton: NO capturar hasta que el contenido real exista.
      await waitForRealContent(page, STAGING_REAL_SIGNAL, `staging-${vp.name}`);
      // El heading de estado (StagingReviewStatus) siempre se renderiza en real.
      await expect(
        page.getByRole('heading', { level: 1 }),
        `staging-${vp.name}: heading real visible (no skeleton)`,
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, `staging-${vp.name}`);
      await assertNoForbiddenCopy(page, `staging-${vp.name}`);
      await page.screenshot({ path: path.join(QA_DIR, `staging-${vp.name}.png`), fullPage: false });
    }

    // Fixture stagingReview = STAGING_REVIEW sin feedback → estado "ready":
    // la UI de staging DEBE aparecer. Sin asserts opcionales que oculten skeleton.

    // Link "Abrir preview" (secundario) — externo y seguro.
    const previewLink = page.getByRole('link', { name: /Abrir preview/i });
    await expect(previewLink, 'Abrir preview presente').toHaveCount(1);
    await expect(previewLink).toHaveAttribute('target', '_blank');
    await expect(previewLink).toHaveAttribute('rel', /noopener/);
    await expect(previewLink).toHaveAttribute('rel', /noreferrer/);

    // Formulario real: textarea con label.
    const textarea = page.locator('#staging-feedback');
    await expect(textarea, 'textarea de feedback presente').toHaveCount(1);
    await expect(page.locator('label[for="staging-feedback"]')).toHaveCount(1);

    // "Solicitar cambios" (subordinado) deshabilitado con textarea vacío.
    const requestBtn = page.getByRole('button', { name: /Solicitar cambios/i });
    await expect(requestBtn).toBeVisible();
    await expect(requestBtn).toBeDisabled();

    // "Aprobar preview" (CTA principal, <button>) — presente, habilitado y
    // de jerarquía distinta al link secundario "Abrir preview".
    const approveBtn = page.getByRole('button', { name: /^Aprobar preview$/i });
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
  });

  test('materiales: checklist visible + input de archivo accesible + captura', async ({ page }) => {
    const projectId =
      tryGetFixtureProjectId('assetsAwaiting') ?? tryGetFixtureProjectId('assetsIncomplete');
    test.skip(!projectId, 'Sin fixture de materiales');

    for (const vp of [VIEWPORTS[0], VIEWPORTS[4]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoOk(page, `/proyecto/${projectId}/assets`);
      // Gate anti-skeleton también en materiales.
      await waitForRealContent(page, ASSETS_REAL_SIGNAL, `assets-${vp.name}`);
      await assertNoHorizontalOverflow(page, `assets-${vp.name}`);
      await assertNoForbiddenCopy(page, `assets-${vp.name}`);

      const text = await page.locator('main').first().innerText();
      // Cabecera del paquete + progreso de requeridos visibles.
      expect(text, `assets-${vp.name}: cabecera del paquete`).toContain('Paquete de materiales');
      expect(text, `assets-${vp.name}: progreso de requeridos`).toContain('requeridos listos');
      // Opcionales agrupados como secundarios (el título del grupo se renderiza en
      // mayúsculas por CSS; innerText devuelve el texto transformado).
      expect(text.toLowerCase(), `assets-${vp.name}: opcionales agrupados`).toContain(
        'opcionales para mejorar tu sitio',
      );

      await page.screenshot({ path: path.join(QA_DIR, `assets-${vp.name}.png`), fullPage: false });
    }

    // El heading humano del paquete está presente (un solo h1 "Paquete de materiales").
    await expect(page.getByRole('heading', { name: /materiales/i }).first()).toBeVisible();

    // Hay un requisito ACTIVO (master-detail / accordion) — el primer requerido pendiente.
    // La lista se renderiza para desktop y mobile (una oculta por CSS): tomamos la visible.
    const activeItem = page.locator('[data-testid="asset-item"][aria-current="true"]:visible').first();
    await expect(activeItem, 'un requisito activo visible').toBeVisible();

    // CTA del paquete presente: "Enviar materiales a revisión".
    const submit = page.getByRole('button', { name: /Enviar materiales a revisión/i });
    await expect(submit, 'CTA de envío presente').toHaveCount(1);

    // Captura del panel/dropzone activo (evidencia del requisito enfocado).
    await page.setViewportSize({ width: VIEWPORTS[4].width, height: VIEWPORTS[4].height });
    await page.screenshot({
      path: path.join(QA_DIR, 'assets-active-panel-1440.png'),
      fullPage: false,
    });
  });
});
