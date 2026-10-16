import fs from 'fs';
import path from 'path';

// Fixture IDs are written by `npm run seed:e2e-auth` to .fixtures.json.
// Tests read them synchronously — no DB connection required in test files.

// ─── Auth policy helpers ────────────────────────────────────────────────────
// Auth state is only considered usable when explicitly opted in:
//   RUN_AUTH_E2E_FULL=1     → globalSetup regenerates fresh sessions
//   PLAYWRIGHT_USE_EXISTING_AUTH=1 → caller accepts responsibility for stale sessions
// Without either flag, existing .auth/*.json files are ignored to avoid
// false failures from expired Clerk sessions.

const AUTH_DIR = path.join(__dirname, '../.auth');
const FULL_AUTH_E2E = process.env.RUN_AUTH_E2E_FULL === '1';
const USE_EXISTING_AUTH = process.env.PLAYWRIGHT_USE_EXISTING_AUTH === '1';

function authFileExists(name: string): boolean {
  try { fs.accessSync(path.join(AUTH_DIR, name)); return true; } catch { return false; }
}

/** Returns true only when Xavier auth is both present and explicitly opted in. */
export function shouldUseAdminAuth(): boolean {
  return (FULL_AUTH_E2E || USE_EXISTING_AUTH) && authFileExists('admin.json');
}

/** Returns true only when client auth is both present and explicitly opted in. */
export function shouldUseClientAuth(): boolean {
  return (FULL_AUTH_E2E || USE_EXISTING_AUTH) && authFileExists('client.json');
}
// ────────────────────────────────────────────────────────────────────────────

interface FixtureIds {
  catalogProjectId: string;
  assetsProjectId: string;
  incompleteProjectId: string;
  stagingProjectId: string;
  liveIncidentsProjectId: string;
  otherProjectId: string;
}

export type FixtureName =
  | 'catalogLive'
  | 'assetsAwaiting'
  | 'assetsIncomplete'
  | 'stagingReview'
  | 'liveIncidents'
  | 'otherClient';

const FIXTURE_KEYS: Record<FixtureName, keyof FixtureIds> = {
  catalogLive: 'catalogProjectId',
  assetsAwaiting: 'assetsProjectId',
  assetsIncomplete: 'incompleteProjectId',
  stagingReview: 'stagingProjectId',
  liveIncidents: 'liveIncidentsProjectId',
  otherClient: 'otherProjectId',
};

// Domains mapped to fixture names for documentation purposes
export const FIXTURE_DOMAINS: Record<FixtureName, string> = {
  catalogLive: 'qa-catalog-project.test',
  assetsAwaiting: 'qa-assets-project.test',
  assetsIncomplete: 'qa-assets-incomplete.test',
  stagingReview: 'qa-staging-review.test',
  liveIncidents: 'qa-live-incidents.test',
  otherClient: 'qa-other-client-project.test',
};

const FIXTURE_FILE = path.join(__dirname, '../.fixtures.json');

function loadFixtures(): Partial<FixtureIds> {
  try {
    const content = fs.readFileSync(FIXTURE_FILE, 'utf-8');
    return JSON.parse(content) as FixtureIds;
  } catch {
    return {};
  }
}

/**
 * Returns the project ID for a named fixture.
 * Throws if fixture file is missing or the entry is absent.
 * Fix: run `npm run seed:e2e-auth`
 */
export function getFixtureProjectId(name: FixtureName): string {
  const fixtures = loadFixtures();
  const key = FIXTURE_KEYS[name];
  const id = fixtures[key];
  if (!id) {
    throw new Error(
      `Fixture "${name}" (${FIXTURE_DOMAINS[name]}) not found in ${FIXTURE_FILE}. ` +
        'Run: cmd /c npm run seed:e2e-auth',
    );
  }
  return id;
}

/**
 * Returns the project ID or null — use this in test bodies where absence should skip the test.
 */
export function tryGetFixtureProjectId(name: FixtureName): string | null {
  try {
    return getFixtureProjectId(name);
  } catch {
    return null;
  }
}
