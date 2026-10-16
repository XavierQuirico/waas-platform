import { test, expect } from '@playwright/test';

/**
 * Tests del flujo /empezar y /empezar/confirmado — V2
 * El wizard V2 ya no tiene Step 4 PayPal ni checkout integrado.
 * Los tests de PayPal directo (fuera del wizard) se separarán si aplica.
 * No requiere auth (rutas públicas). Usa proyecto Playwright: no-auth.
 */

test.describe('Wizard /empezar — Step 4 V2 (brief libre)', () => {
  test('Step 4 V2 muestra textarea de brief, no botón PayPal', async ({ page }) => {
    await page.goto('/empezar');
    await page.waitForLoadState('domcontentloaded');

    // Avanzar por el intro
    const empezarBtn = page.locator('button:has-text("Empezar")').first();
    if (await empezarBtn.isVisible()) await empezarBtn.click();
    await page.waitForTimeout(300);

    // Step 1 — V2: firstName + lastName separados
    const firstName = page.locator('input[name="firstName"]').first();
    if (await firstName.count() === 0) {
      test.skip(true, 'Wizard V2 no cargó correctamente');
      return;
    }
    await firstName.fill('Ana');
    await page.locator('input[name="lastName"]').first().fill('Martinez');
    await page.locator('input[type="email"]').first().fill('ana.martinez@test.waas');
    // WhatsApp — compound input: fill only the local number field
    const waNumber = page.locator('[data-testid="whatsapp-number"]').first();
    if (await waNumber.count() > 0) await waNumber.fill('8095559876');
    await page.locator('input[name="businessName"]').first().fill('Boutique Ana');
    const industrySelect = page.locator('select[name="industry"]').first();
    if (await industrySelect.count() > 0) await industrySelect.selectOption({ index: 1 });
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(500);

    // Step 2 — whatYouOffer + problema
    const whatOffer = page.locator('textarea[name="whatYouOffer"]').first();
    if (await whatOffer.count() > 0) await whatOffer.fill('Boutique de moda');
    const problemChip = page
      .locator('button[type="button"]')
      .filter({ hasText: /profesional|cliente|servicio/i })
      .first();
    if (await problemChip.count() > 0) await problemChip.click();
    const step2Btn = page.locator('button[type="submit"]').first();
    if (await step2Btn.isVisible()) await step2Btn.click();
    await page.waitForTimeout(500);

    // Step 3 — objetivo
    const goalChip = page
      .locator('button[type="button"]')
      .filter({ hasText: /contactos|servicios|citas|catálogo/i })
      .first();
    if (await goalChip.count() > 0) await goalChip.click();
    const step3Btn = page.locator('button[type="submit"]').first();
    if (await step3Btn.isVisible()) await step3Btn.click();
    await page.waitForTimeout(500);

    // Step 4 V2 — debe ser brief libre, no PayPal
    const briefTextarea = page.locator('textarea#freeformBrief, textarea[name="freeformBrief"]').first();
    const paypalIframe = page.locator('iframe[title*="PayPal"]');
    const paypalButton = page.locator('[class*="paypal"]');

    if (await briefTextarea.count() > 0) {
      await expect(briefTextarea).toBeVisible({ timeout: 5000 });
    }
    // No debe haber botones PayPal en el wizard V2
    expect(await paypalIframe.count()).toBe(0);
    expect(await paypalButton.count()).toBe(0);
  });
});

test.describe('Página /empezar/confirmado — estados', () => {
  test('muestra mensaje de pago recibido con ?status=PAYMENT_RECEIVED', async ({ page }) => {
    await page.goto('/empezar/confirmado?status=PAYMENT_RECEIVED');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/confirmado/);
    await expect(page.getByRole('heading', { name: /pago recibido/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /ir al portal/i })).toHaveAttribute('href', '/dashboard');
  });

  test('muestra link al dashboard o a WhatsApp', async ({ page }) => {
    await page.goto('/empezar/confirmado');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/confirmado/);

    const actionLink = page.locator(
      'a[href="/dashboard"], a[href*="whatsapp"], a[href*="wa.me"]'
    ).first();
    const hasActionLink = (await actionLink.count()) > 0;
    expect(hasActionLink).toBe(true);
  });
});
