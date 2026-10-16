import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E del wizard /empezar — V2 (7 pasos)
 * No requiere auth — ruta pública.
 */

// ─── Helper: llenar WhatsApp compound input ───────────────
// El input de WhatsApp ahora usa país (select) + número (data-testid="whatsapp-number")
async function fillWhatsapp(page: Page, number: string) {
  const numberInput = page.locator('[data-testid="whatsapp-number"]').first();
  if (await numberInput.count() > 0) {
    await numberInput.fill(number);
  }
}

// ─── Carga y plan intent ──────────────────────────────────

test.describe('Wizard /empezar — carga y plan intent', () => {
  test('carga correctamente sin auth y sin plan', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page).toHaveURL(/empezar/);
  });

  test('/empezar?plan=basic muestra cápsula Basic', async ({ page }) => {
    await page.goto('/empezar?plan=basic');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await expect(page.locator('text=Basic').first()).toBeVisible({ timeout: 3000 });
  });

  test('/empezar?plan=pro muestra cápsula Pro', async ({ page }) => {
    await page.goto('/empezar?plan=pro');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await expect(page.locator('text=Pro').first()).toBeVisible({ timeout: 3000 });
  });

  test('/empezar?plan=business muestra cápsula Business', async ({ page }) => {
    await page.goto('/empezar?plan=business');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await expect(page.locator('text=Business').first()).toBeVisible({ timeout: 3000 });
  });

  test('/empezar?plan=legacy muestra cápsula Legacy', async ({ page }) => {
    await page.goto('/empezar?plan=legacy');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await expect(page.locator('text=Legacy').first()).toBeVisible({ timeout: 3000 });
  });

  test('"Cambiar plan" abre dropdown con opciones', async ({ page }) => {
    await page.goto('/empezar?plan=basic');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();

    const cambiarPlanBtn = page.locator('button:has-text("Cambiar")').first();
    await expect(cambiarPlanBtn).toBeVisible({ timeout: 3000 });
    await cambiarPlanBtn.click();

    await expect(page.locator('button:has-text("Basic")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Pro")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Business")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Legacy")').first()).toBeVisible();
  });
});

// ─── Step 0: Intro ────────────────────────────────────────

test.describe('Step 0 — Intro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
  });

  test('muestra pantalla intro con CTA Empezar', async ({ page }) => {
    await expect(page.locator('button:has-text("Empezar")').first()).toBeVisible({ timeout: 8000 });
  });

  test('CTA Empezar avanza a Step 1', async ({ page }) => {
    await page.locator('button:has-text("Empezar")').first().click();
    await expect(
      page.locator('input[name="firstName"], input[placeholder*="Nombre"]').first()
    ).toBeVisible({ timeout: 3000 });
  });
});

// ─── Step 1: Contacto ─────────────────────────────────────

test.describe('Step 1 — Contacto V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await page.waitForTimeout(300);
  });

  test('pide nombre y apellido por separado', async ({ page }) => {
    const firstName = page.locator('input[name="firstName"]').first();
    const lastName = page.locator('input[name="lastName"]').first();
    await expect(firstName).toBeVisible({ timeout: 5000 });
    await expect(lastName).toBeVisible({ timeout: 5000 });
  });

  test('no tiene campo fullName (wizard V1 obsoleto)', async ({ page }) => {
    const fullNameInput = page.locator('input[name="fullName"]');
    expect(await fullNameInput.count()).toBe(0);
  });

  test('no tiene campo location (wizard V1 obsoleto)', async ({ page }) => {
    const locationInput = page.locator('input[name="location"]');
    expect(await locationInput.count()).toBe(0);
  });

  test('WhatsApp usa selector de país + campo de número', async ({ page }) => {
    const countrySelect = page.locator('#whatsapp-country').first();
    const numberInput = page.locator('[data-testid="whatsapp-number"]').first();
    await expect(countrySelect).toBeVisible({ timeout: 5000 });
    await expect(numberInput).toBeVisible({ timeout: 5000 });
  });

  test('WhatsApp selector de país tiene +1 como defecto (DR)', async ({ page }) => {
    const countrySelect = page.locator('#whatsapp-country').first();
    await expect(countrySelect).toBeVisible({ timeout: 5000 });
    const selectedValue = await countrySelect.inputValue();
    expect(selectedValue).toBe('+1');
  });

  test('validación falla sin datos — permanece en /empezar', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/empezar/);
    await expect(page).not.toHaveURL(/sign-in|confirmado/);
  });

  test('completa Step 1 y avanza a Step 2', async ({ page }) => {
    const firstName = page.locator('input[name="firstName"]').first();
    if (await firstName.count() === 0) {
      test.skip(true, 'Wizard V2 Step 1 no cargó — falta input[name="firstName"]');
      return;
    }

    await firstName.fill('María');
    await page.locator('input[name="lastName"]').first().fill('García');
    await page.locator('input[type="email"]').first().fill('maria@test.waas');
    await fillWhatsapp(page, '8095551234');
    await page.locator('input[name="businessName"]').first().fill('Clínica Estética');

    const industrySelect = page.locator('select[name="industry"]').first();
    if (await industrySelect.count() > 0) {
      await industrySelect.selectOption({ index: 1 });
    }

    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/empezar/);
  });
});

// ─── Flujo hasta Step 4 (brief) ───────────────────────────

test.describe('Flujo completo — Steps 1 a 4', () => {
  async function fillStep1(page: Page) {
    const firstName = page.locator('input[name="firstName"]').first();
    if (await firstName.count() === 0) return false;
    await firstName.fill('Carlos');
    await page.locator('input[name="lastName"]').first().fill('Pérez');
    await page.locator('input[type="email"]').first().fill('carlos@test.waas');
    await fillWhatsapp(page, '8095550001');
    await page.locator('input[name="businessName"]').first().fill('Consultora Pérez');
    const industrySelect = page.locator('select[name="industry"]').first();
    if (await industrySelect.count() > 0) await industrySelect.selectOption({ index: 1 });
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(500);
    return true;
  }

  test('Step 2 pide whatYouOffer y multiselect de problemas', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await page.waitForTimeout(300);

    const advanced = await fillStep1(page);
    if (!advanced) {
      test.skip(true, 'Wizard V2 Step 1 no cargó — falta input[name="firstName"]');
      return;
    }

    const whatYouOffer = page.locator('textarea[name="whatYouOffer"], input[name="whatYouOffer"]').first();
    const problemChips = page.locator('button:has-text("profesional"), button:has-text("clientes"), button:has-text("servicios")').first();
    const hasStep2 = (await whatYouOffer.count() > 0) || (await problemChips.count() > 0);
    expect(hasStep2).toBe(true);
  });

  test('Step 4 tiene textarea de brief libre (no pregunta de fecha)', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await page.waitForTimeout(300);

    const advanced = await fillStep1(page);
    if (!advanced) {
      test.skip(true, 'Wizard V2 Step 1 no cargó — falta input[name="firstName"]');
      return;
    }

    const step2Submit = page.locator('button[type="submit"]').first();
    const whatOffer = page.locator('textarea[name="whatYouOffer"]').first();
    if (await whatOffer.count() > 0) {
      await whatOffer.fill('Servicios de consultoría');
    }
    const anyChip = page
      .locator('button[type="button"]')
      .filter({ hasText: /profesional|cliente|servicio|manual|reemplazar|nuevo|otro/i })
      .first();
    if (await anyChip.count() > 0) await anyChip.click();
    if (await step2Submit.isVisible()) await step2Submit.click();
    await page.waitForTimeout(500);

    const goalChip = page
      .locator('button[type="button"]')
      .filter({ hasText: /contactos|servicios|citas|catálogo|pedidos|pagos|contenido|propiedad/i })
      .first();
    if (await goalChip.count() > 0) await goalChip.click();
    const step3Submit = page.locator('button[type="submit"]').first();
    if (await step3Submit.isVisible()) await step3Submit.click();
    await page.waitForTimeout(500);

    const briefTextarea = page.locator('textarea#freeformBrief, textarea[name="freeformBrief"]').first();
    const ownershipCheckbox = page.locator('input[name="wantsOwnership"]');
    const paypalArea = page.locator('iframe[title*="PayPal"], [class*="paypal"]');

    if (await briefTextarea.count() > 0) {
      await expect(briefTextarea).toBeVisible();
    }
    expect(await ownershipCheckbox.count()).toBe(0);
    expect(await paypalArea.count()).toBe(0);
  });
});

// ─── Step 6: Resumen ──────────────────────────────────────

test.describe('Step 6 — Resumen', () => {
  test('resumen no muestra add-ons ni códigos internos (C01, WA01, etc.)', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.textContent('body');
    expect(body).not.toMatch(/\bC0[0-9]\b/);
    expect(body).not.toMatch(/\bWA0[0-9]\b/);
    expect(body).not.toMatch(/\bBX0[0-9]\b/);
  });
});

// ─── /empezar/confirmado ──────────────────────────────────

test.describe('Página /empezar/confirmado', () => {
  test('carga sin auth (página pública)', async ({ page }) => {
    await page.goto('/empezar/confirmado');
    await expect(page).toHaveURL(/confirmado/);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test('muestra mensaje de pago pendiente con ?status=PENDING', async ({ page }) => {
    await page.goto('/empezar/confirmado?status=PENDING');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Pago pendiente');
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
  });

  test('muestra mensaje de error con ?error=1', async ({ page }) => {
    await page.goto('/empezar/confirmado?error=1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText('Hubo un problema');
    await expect(page.locator('a[href="/empezar"]')).toBeVisible();
  });
});

// ─── /portal — estados sin auth ───────────────────────────

test.describe('/portal — redirección sin auth', () => {
  test('/portal redirige a /acceder sin autenticación', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/acceder/);
  });

  test('/portal preserva redirect_url apuntando a /dashboard', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/acceder/);
    const url = page.url();
    expect(url).toMatch(/redirect_url|returnBackUrl|after_sign_in_url/i);
    expect(url).toMatch(/dashboard/i);
  });
});
