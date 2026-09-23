/**
 * Resolve the shared Savyre guard script (same brain as Cursor).
 * Prefer env, then sibling cursor plugin, then common install paths.
 */
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
const HOME = os.homedir();

export function resolveGuardPath() {
  const env = typeof process.env.SAVYRE_GUARD_PATH === 'string'
    ? process.env.SAVYRE_GUARD_PATH.trim()
    : '';
  if (env && existsSync(env)) return env;

  const candidates = [
    path.join(PLUGIN_ROOT, '..', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs'),
    path.join(HOME, 'Documents', 'Projects', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs'),
    path.join(HOME, '.cursor', 'plugins', 'local', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs'),
    path.join(HOME, '.claude', 'plugins', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs')
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function pluginRoot() {
  return PLUGIN_ROOT;
}
