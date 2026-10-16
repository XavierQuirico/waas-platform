// Removes .next cache before E2E runs to prevent Windows file-lock errors
// on repeated next dev restarts (UNKNOWN: open '.next/server/vendor-chunks/next.js').
const { rmSync, existsSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const nextDir = join(root, '.next');

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write('[clean-next] .next removed.\n');
} else {
  process.stdout.write('[clean-next] .next not found — nothing to clean.\n');
}
