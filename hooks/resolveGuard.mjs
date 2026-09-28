/**
 * Resolve the shared Savyre guard script (same brain as Cursor).
 * Prefer the sensitive plugin option, then a sibling checkout next to this pack.
 * Do not scan the user home directory.
 */
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');

function configuredGuardPath() {
  const raw = process.env.CLAUDE_PLUGIN_OPTION_SAVYRE_GUARD_PATH;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function resolveGuardPath() {
  const configured = configuredGuardPath();
  if (configured && existsSync(configured)) return configured;

  const sibling = path.join(PLUGIN_ROOT, '..', 'savyre-cursor-plugin', 'hooks', 'savyre-guard.mjs');
  if (existsSync(sibling)) return sibling;

  return null;
}

export function pluginRoot() {
  return PLUGIN_ROOT;
}
