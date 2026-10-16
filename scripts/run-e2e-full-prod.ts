/**
 * Full-auth production E2E orchestrator.
 *
 * 1. Remove .next to prevent dev/prod cache mix
 * 2. npm run build (production build)
 * 3. Start "npx next start -p 3005" in background
 * 4. Poll /api/health until 200 OK (max 120s)
 * 5. npm run test:e2e:full:prod
 * 6. Kill server
 * 7. Exit with test exit code
 *
 * Usage:
 *   npm run test:e2e:full:prod:clean
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PORT = 3005;
const HEALTH_PATH = '/api/health';
const HEALTH_TIMEOUT_MS = 120_000;
const HEALTH_POLL_MS = 2_000;

function log(msg: string) {
  process.stdout.write(`[run-e2e-full-prod] ${msg}\n`);
}

function cleanNext() {
  const nextDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    log('Removing .next directory...');
    fs.rmSync(nextDir, { recursive: true, force: true });
    log('.next removed.');
  } else {
    log('.next not found — nothing to clean.');
  }
}

function checkHealth(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port: PORT, path: HEALTH_PATH }, res => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  log(`Waiting for http://localhost:${PORT}${HEALTH_PATH}...`);
  while (Date.now() < deadline) {
    if (await checkHealth()) {
      log('Server is ready.');
      return;
    }
    await new Promise(r => setTimeout(r, HEALTH_POLL_MS));
  }
  throw new Error(`Server not ready at http://localhost:${PORT}${HEALTH_PATH} after ${HEALTH_TIMEOUT_MS}ms`);
}

async function main() {
  cleanNext();

  log('Running npm run build...');
  execSync('npm run build', { stdio: 'inherit', shell: true });
  log('Build complete.');

  log(`Starting next start on port ${PORT}...`);
  const server = spawn(
    `npx next start -p ${String(PORT)}`,
    { stdio: 'inherit', shell: true, detached: false }
  );

  server.on('error', err => {
    log(`Server process error: ${err.message}`);
  });

  let testExitCode = 1;
  try {
    await waitForHealth();

    log('Running npm run test:e2e:full:prod...');
    try {
      execSync('npm run test:e2e:full:prod', { stdio: 'inherit', shell: true });
      testExitCode = 0;
    } catch (err: unknown) {
      testExitCode = (err as { status?: number }).status ?? 1;
      log(`Tests finished with exit code ${testExitCode}.`);
    }
  } finally {
    log('Stopping server...');
    if (process.platform === 'win32' && server.pid != null) {
      try {
        execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // process may already be gone
      }
    } else {
      server.kill('SIGTERM');
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  process.exit(testExitCode);
}

main().catch(err => {
  console.error('[run-e2e-full-prod] Fatal error:', err);
  process.exit(1);
});
