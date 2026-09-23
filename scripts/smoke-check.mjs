#!/usr/bin/env node
/**
 * Smoke-check: transform helpers + guard resolution + optional live turn.
 * Usage: node scripts/smoke-check.mjs [workspace]
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGuardPath } from '../hooks/resolveGuard.mjs';
import { toCursorHookInput, toClaudeHookOutput } from '../hooks/savyre-claude-hook.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL ${msg}\n`);
    failed += 1;
  } else {
    process.stdout.write(`ok  ${msg}\n`);
  }
}

// Transform: Claude Edit → Cursor StrReplace + preToolUse
{
  const cursor = toCursorHookInput({
    hook_event_name: 'PreToolUse',
    tool_name: 'Edit',
    cwd: process.cwd(),
    tool_input: { file_path: 'stages/s04_build_review/change_report.md', old_string: 'a', new_string: 'b' }
  });
  assert(cursor.hook_event_name === 'preToolUse', 'maps PreToolUse → preToolUse');
  assert(cursor.tool_name === 'StrReplace', 'maps Edit → StrReplace');
  assert(cursor.file_path.includes('change_report.md'), 'forwards file_path');
}

{
  const out = toClaudeHookOutput(
    { permission: 'deny', user_message: 'blocked', agent_message: 'do not write' },
    'PreToolUse'
  );
  assert(out.hookSpecificOutput?.permissionDecision === 'deny', 'deny → permissionDecision deny');
}

{
  const out = toClaudeHookOutput(
    { additional_context: 'Savyre stage s04 is enforced.' },
    'SessionStart'
  );
  assert(
    out.hookSpecificOutput?.additionalContext?.includes('enforced'),
    'sessionStart additional_context maps'
  );
}

const guard = resolveGuardPath();
assert(Boolean(guard), `guard resolves (${guard || 'missing'})`);

const workspace = process.argv[2];
if (workspace && existsSync(path.join(workspace, '.savyre'))) {
  const cli = path.join(HERE, 'savyre-cli.mjs');
  const result = spawnSync(process.execPath, [cli, 'status'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 30000
  });
  assert(result.status === 0 || (result.stdout || '').includes('{'), 'status CLI runs against workspace');
  process.stdout.write(`status exit=${result.status}\n`);
}

process.exit(failed ? 1 : 0);
