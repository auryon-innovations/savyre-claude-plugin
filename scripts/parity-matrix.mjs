#!/usr/bin/env node
/**
 * Stage / skill / command parity matrix for Claude adapter vs Cursor plugin.
 *
 * Usage:
 *   node scripts/parity-matrix.mjs
 *   node scripts/parity-matrix.mjs /path/to/savyre-project
 */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGuardPath, pluginRoot } from '../hooks/resolveGuard.mjs';
import { toCursorHookInput, toClaudeHookOutput } from '../hooks/savyre-claude-hook.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const home = os.homedir();

const EXPECTED_TOP_SKILLS = [
  'savyre-chat-continuation',
  'savyre-codebase-discovery',
  'savyre-evidence-grounding',
  'savyre-failure-recovery',
  'savyre-impact-analyst',
  'savyre-implementation',
  'savyre-intervention-judge',
  'savyre-plan-generation-and-review',
  'savyre-requirement-analyst',
  'savyre-requirement-challenge',
  'savyre-response-composer',
  'savyre-run-stage',
  'savyre-task-input',
  'savyre-unified-chat-turn',
  'savyre-verification-before-completion'
];

const EXPECTED_SEVEN_STAGE_SKILLS = [
  'savyre-stage-task-definition',
  'savyre-stage-code-discovery',
  'savyre-stage-implementation-plan',
  'savyre-stage-build-review',
  'savyre-stage-test-resolve',
  'savyre-stage-delivery-readiness',
  'savyre-stage-handoff'
];

const EXPECTED_COMMANDS = [
  'savyre-start.md',
  'savyre-next.md',
  'savyre-turn.md',
  'savyre-answer.md',
  'savyre-stop.md',
  'savyre-status.md'
];

const STAGE_ROLES = [
  { stage: '01 / s01', skills: ['savyre-task-input', 'savyre-stage-task-definition'] },
  { stage: '02', skills: ['savyre-requirement-analyst', 'savyre-requirement-challenge'] },
  { stage: '03 / s02', skills: ['savyre-codebase-discovery', 'savyre-evidence-grounding', 'savyre-stage-code-discovery'] },
  { stage: '04', skills: ['savyre-impact-analyst'] },
  { stage: '05 / s03', skills: ['savyre-plan-generation-and-review', 'savyre-stage-implementation-plan'] },
  { stage: '06 / s04', skills: ['savyre-implementation', 'savyre-stage-build-review'] },
  { stage: 's05', skills: ['savyre-stage-test-resolve'] },
  { stage: 's06', skills: ['savyre-stage-delivery-readiness'] },
  { stage: 's07', skills: ['savyre-stage-handoff'] },
  {
    stage: 'shared',
    skills: [
      'savyre-run-stage',
      'savyre-response-composer',
      'savyre-unified-chat-turn',
      'savyre-intervention-judge',
      'savyre-chat-continuation',
      'savyre-failure-recovery',
      'savyre-verification-before-completion'
    ]
  }
];

let failed = 0;
const rows = [];

function ok(cond, msg) {
  if (cond) {
    process.stdout.write(`ok  ${msg}\n`);
    rows.push({ check: msg, pass: true });
  } else {
    process.stderr.write(`FAIL ${msg}\n`);
    rows.push({ check: msg, pass: false });
    failed += 1;
  }
}

function listSkillDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function skillPresent(name) {
  return (
    existsSync(path.join(ROOT, 'skills', name, 'SKILL.md')) ||
    existsSync(path.join(ROOT, 'bundles', 'bundle_candidate_1', 'skills', name, 'SKILL.md'))
  );
}

// --- Plugin packaging ---
ok(existsSync(path.join(ROOT, '.claude-plugin', 'plugin.json')), 'plugin.json present');
ok(existsSync(path.join(ROOT, '.claude-plugin', 'marketplace.json')), 'marketplace.json present');
ok(existsSync(path.join(ROOT, 'hooks', 'hooks.json')), 'hooks.json present');
ok(existsSync(path.join(ROOT, 'hooks', 'savyre-claude-hook.mjs')), 'hook adapter present');

try {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  ok(Boolean(manifest.name && manifest.version), `plugin identity ${manifest.name}@${manifest.version}`);
} catch {
  ok(false, 'plugin.json parses');
}

try {
  const market = JSON.parse(readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  ok(Boolean(market.name && Array.isArray(market.plugins) && market.plugins.length >= 1), 'marketplace lists plugin');
} catch {
  ok(false, 'marketplace.json parses');
}

// --- Commands ---
for (const cmd of EXPECTED_COMMANDS) {
  ok(existsSync(path.join(ROOT, 'commands', cmd)), `command ${cmd}`);
}

// --- Skills ---
const topSkills = listSkillDirs(path.join(ROOT, 'skills'));
for (const name of EXPECTED_TOP_SKILLS) {
  ok(topSkills.includes(name) && existsSync(path.join(ROOT, 'skills', name, 'SKILL.md')), `top skill ${name}`);
}
ok(topSkills.length >= EXPECTED_TOP_SKILLS.length, `top skill count >= ${EXPECTED_TOP_SKILLS.length} (got ${topSkills.length})`);

for (const name of EXPECTED_SEVEN_STAGE_SKILLS) {
  ok(skillPresent(name), `seven-stage skill ${name}`);
}

for (const row of STAGE_ROLES) {
  const missing = row.skills.filter((s) => !skillPresent(s));
  ok(missing.length === 0, `stage role pack ${row.stage}${missing.length ? ` missing ${missing.join(',')}` : ''}`);
}

// --- Compare to Cursor if available ---
const cursorRoots = [
  path.join(home, 'Documents', 'Projects', 'savyre-cursor-plugin'),
  path.join(home, '.cursor', 'plugins', 'local', 'savyre-cursor-plugin')
];
const cursorRoot = cursorRoots.find((p) => existsSync(path.join(p, 'skills')));
if (cursorRoot) {
  const cursorSkills = listSkillDirs(path.join(cursorRoot, 'skills'));
  const missingFromClaude = cursorSkills.filter((s) => !topSkills.includes(s));
  ok(missingFromClaude.length === 0, `Claude top skills match Cursor (${cursorSkills.length})${missingFromClaude.length ? ` missing ${missingFromClaude.join(',')}` : ''}`);
} else {
  process.stdout.write('skip Cursor skill diff (cursor plugin not found)\n');
}

// --- Event map ---
{
  const cursor = toCursorHookInput({
    hook_event_name: 'PreToolUse',
    tool_name: 'Edit',
    cwd: process.cwd(),
    tool_input: { file_path: 'stages/s04_build_review/change_report.md', old_string: 'a', new_string: 'b' }
  });
  ok(cursor.hook_event_name === 'preToolUse' && cursor.tool_name === 'StrReplace', 'Edit→StrReplace preToolUse');
}
{
  const out = toClaudeHookOutput({ permission: 'deny', user_message: 'blocked' }, 'PreToolUse');
  ok(out.hookSpecificOutput?.permissionDecision === 'deny', 'deny maps to Claude permissionDecision');
}
{
  const out = toClaudeHookOutput({ additional_context: 'Savyre stage s04 is enforced.' }, 'SessionStart');
  ok(Boolean(out.hookSpecificOutput?.additionalContext), 'SessionStart additionalContext');
}

const guard = resolveGuardPath();
ok(Boolean(guard), `guard resolves (${guard || 'missing'})`);

// --- Optional live workspace ---
const workspace = process.argv[2];
if (workspace && existsSync(path.join(workspace, '.savyre'))) {
  const cli = path.join(HERE, 'savyre-cli.mjs');
  for (const verb of ['status']) {
    const result = spawnSync(process.execPath, [cli, verb], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 30000
    });
    ok(result.status === 0 || (result.stdout || '').includes('{'), `live CLI ${verb} against workspace`);
  }
}

process.stdout.write(
  `\nparity summary: ${rows.filter((r) => r.pass).length}/${rows.length} pass; pluginRoot=${pluginRoot()}\n`
);
process.exit(failed ? 1 : 0);
