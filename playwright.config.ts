import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Capturar ANTES de dotenv para preservar valores del shell/CI
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === '1';
const FULL_AUTH_E2E = process.env.RUN_AUTH_E2E_FULL === '1';
// Auth files are used only when explicitly opted in to avoid false failures from expired sessions.
const USE_EXISTING_AUTH = process.env.PLAYWRIGHT_USE_EXISTING_AUTH === '1';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.test.local', override: true });

const AUTH_DIR = path.join(__dirname, 'tests/e2e/.auth');
const hasAdminAuth = () => {
  try {
    require('fs').accessSync(path.join(AUTH_DIR, 'admin.json'));
    return true;
  } catch {
    return false;
  }
};
const hasClientAuth = () => {
  try {
    require('fs').accessSync(path.join(AUTH_DIR, 'client.json'));
    return true;
  } catch {
    return false;
  }
};
const shouldUseAdminAuth = () => (FULL_AUTH_E2E || USE_EXISTING_AUTH) && hasAdminAuth();
const shouldUseClientAuth = () => (FULL_AUTH_E2E || USE_EXISTING_AUTH) && hasClientAuth();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Tests sin auth — siempre corren
    {
      name: 'no-auth',
      testMatch: [
        'auth-protection.spec.ts',
        'empezar-wizard.spec.ts',
        'paypal-checkout.spec.ts',
        'ticket-quote-payment.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // Tests con sesión Xavier (admin)
    {
      name: 'admin',
      testMatch: ['admin-proyectos.spec.ts', 'catalog-commercial.spec.ts', 'admin-isolation.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        ...(shouldUseAdminAuth() ? { storageState: path.join(AUTH_DIR, 'admin.json') } : {}),
      },
    },
    // Tests con sesión de cliente
    {
      name: 'cliente',
      testMatch: [
        'portal-assets.spec.ts',
        'staging-review.spec.ts',
        'incidencias.spec.ts',
        'security-isolation.spec.ts',
        'catalog-commercial.spec.ts',
        'portal-authenticated.spec.ts',
        'portal-shell.spec.ts',
        'dashboard.spec.ts',
        'portal-shell-icons.spec.ts',
        'project-experience.spec.ts',
        'settings.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        ...(shouldUseClientAuth() ? { storageState: path.join(AUTH_DIR, 'client.json') } : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3005',
    url: 'http://localhost:3005/api/health',
    reuseExistingServer,
    timeout: 120_000,
  },
});
