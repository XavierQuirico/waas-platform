/**
 * Playwright Global Setup — autenticación Clerk con @clerk/testing
 *
 * Corre UNA vez antes de todos los tests.
 *
 * Estrategia: clerk.signIn({ emailAddress }) — backend ticket (NO UI)
 *   1. clerkSetup() → obtiene testing token de Clerk API usando CLERK_SECRET_KEY
 *   2. clerk.signIn({ page, emailAddress }) →
 *      a. configura interceptor FAPI (testing token en todas las llamadas)
 *      b. espera window.Clerk.loaded
 *      c. llama Clerk Admin API: getUserList + createSignInToken
 *      d. redime ticket en browser: Clerk.client.signIn.create({strategy:'ticket'})
 *      e. setActive → sesión completa
 *   — bypasea: factor-two, device verification, bot detection, password
 *
 * Genera:
 *   tests/e2e/.auth/admin.json  — admin (qa-admin+clerk_test@example.com)
 *   tests/e2e/.auth/client.json  — cliente (qa-client+clerk_test@example.com)
 *
 * Variables requeridas en .env.test.local:
 *   TEST_ADMIN_EMAIL, TEST_CLIENT_EMAIL
 *
 * Activar auth E2E: RUN_AUTH_E2E_FULL=1
 */

// Capturar ANTES de dotenv para preservar valor del shell/CI
const FULL_AUTH_E2E = process.env.RUN_AUTH_E2E_FULL === '1';

import { chromium } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.test.local', override: true });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3005';
const AUTH_DIR = path.join(__dirname, '.auth');

/**
 * Genera un archivo .auth/<name>.json para el email dado.
 * Usa Clerk backend ticket strategy — no toca el sign-in form, bypasea factor-two.
 */
async function loginAs(email: string, outputFile: string): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const masked = email.replace(/(?<=.{3}).+(?=@)/, '***');

  try {
    // Navegar a /acceder (página canónica) para cargar Clerk JS en el browser.
    // /sign-in redirige a /acceder (neutralizado) causando ERR_TOO_MANY_REDIRECTS.
    // clerk.signIn() internamente espera window.Clerk.loaded — funciona desde /acceder.
    await page.goto(`${BASE_URL}/acceder`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Sign-in programático via Clerk Admin API (ticket strategy):
    //   - No interactúa con la UI de Clerk
    //   - No puede quedar bloqueado en factor-two ni device verification
    //   - Requiere CLERK_SECRET_KEY para llamar getUserList + createSignInToken
    await clerk.signIn({ page, emailAddress: email });

    await context.storageState({ path: outputFile });
    console.log(`[global-setup] Auth guardada para ${masked}: ${outputFile}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[global-setup] Login falló para ${masked}: ${msg}`);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  // clerkSetup():
  //   1. Lee CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY del env
  //   2. Llama testingTokens.createTestingToken() en la Clerk API
  //   3. Guarda process.env.CLERK_FAPI + process.env.CLERK_TESTING_TOKEN
  // clerk.signIn() internamente depende de CLERK_FAPI y CLERK_TESTING_TOKEN
  await clerkSetup();

  if (!FULL_AUTH_E2E) {
    console.warn('[global-setup] RUN_AUTH_E2E_FULL no activo — auth E2E quedará skipped');
    return;
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const clientEmail = process.env.TEST_CLIENT_EMAIL;

  const missing = [
    ['TEST_ADMIN_EMAIL', adminEmail],
    ['TEST_CLIENT_EMAIL', clientEmail],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `[global-setup] RUN_AUTH_E2E_FULL=1 requiere variables faltantes: ${missing.join(', ')}`
    );
  }

  await loginAs(adminEmail!, path.join(AUTH_DIR, 'admin.json'));
  await loginAs(clientEmail!, path.join(AUTH_DIR, 'client.json'));
}
