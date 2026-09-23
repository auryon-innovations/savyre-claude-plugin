#!/usr/bin/env node
/**
 * Sync skills from savyre-cursor-plugin into this Claude adapter.
 * Keeps Claude skill text identical to Cursor (shared role instructions).
 *
 * Usage: node scripts/sync-skills.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const home = os.homedir();

const CURSOR_CANDIDATES = [
  path.join(home, 'Documents', 'Projects', 'savyre-cursor-plugin'),
  path.join(home, '.cursor', 'plugins', 'local', 'savyre-cursor-plugin'),
  process.env.SAVYRE_CURSOR_PLUGIN_ROOT || ''
].filter(Boolean);

function resolveCursorRoot() {
  for (const p of CURSOR_CANDIDATES) {
    if (p && existsSync(path.join(p, 'skills'))) return p;
  }
  return null;
}

function copyTree(src, dst) {
  if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
  mkdirSync(path.dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

const cursorRoot = resolveCursorRoot();
if (!cursorRoot) {
  process.stderr.write(
    'savyre-cursor-plugin not found. Set SAVYRE_CURSOR_PLUGIN_ROOT or install sibling/local plugin.\n'
  );
  process.exit(1);
}

const topSrc = path.join(cursorRoot, 'skills');
const topDst = path.join(ROOT, 'skills');
copyTree(topSrc, topDst);

const bundleSrc = path.join(cursorRoot, 'bundles', 'bundle_candidate_1', 'skills');
const bundleDst = path.join(ROOT, 'bundles', 'bundle_candidate_1', 'skills');
let bundleCount = 0;
if (existsSync(bundleSrc)) {
  copyTree(bundleSrc, bundleDst);
  bundleCount = readdirSync(bundleDst, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
}

const topCount = readdirSync(topDst, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
const overlayRoot = path.join(ROOT, 'overlays');
let overlaysApplied = 0;
if (existsSync(overlayRoot)) {
  for (const name of readdirSync(overlayRoot, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const from = path.join(overlayRoot, name.name);
    const to = path.join(topDst, name.name);
    if (!existsSync(to)) mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
    overlaysApplied += 1;
  }
}

const manifest = {
  syncedAt: new Date().toISOString(),
  cursorPluginRoot: cursorRoot,
  topLevelSkills: topCount,
  bundleCandidateSkills: bundleCount,
  overlaysApplied
};
writeFileSync(path.join(ROOT, 'skills', '.sync-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(
  JSON.stringify({ ok: true, ...manifest, topSkillsDir: topDst, bundleSkillsDir: bundleDst }, null, 2) + '\n'
);
