#!/usr/bin/env node
/**
 * Thin CLI wrapper: node scripts/savyre-cli.mjs start|turn|next|answer|stop|status …
 * Forwards to the shared savyre-guard.mjs.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGuardPath } from '../hooks/resolveGuard.mjs';

const args = process.argv.slice(2);
const guard = resolveGuardPath();
if (!guard) {
  process.stderr.write(
    'Savyre guard not found. Install savyre-cursor-plugin (sibling or ~/.cursor/plugins/local/) or set SAVYRE_GUARD_PATH.\n'
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [guard, ...args], {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe']
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status == null ? 1 : result.status);
