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
import {
  collectRequestUsage,
  mapClaudeUsageToTurn,
  mergeChatUsage,
  parseTranscriptJsonl,
  turnUsageFromTranscript
} from '../hooks/savyre-claude-usage.mjs';

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

{
  const turn = mapClaudeUsageToTurn({
    input_tokens: 10,
    output_tokens: 2,
    cache_read_input_tokens: 5
  });
  assert(turn?.prompt_tokens === 15 && turn.total_tokens === 17, 'maps Claude cache tokens into prompt');
}

{
  const text = [
    JSON.stringify({
      requestId: 'r1',
      message: {
        model: 'claude-sonnet-4-5',
        usage: { input_tokens: 100, output_tokens: 4, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      }
    }),
    JSON.stringify({
      requestId: 'r1',
      message: {
        model: 'claude-sonnet-4-5',
        usage: { input_tokens: 100, output_tokens: 9, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
      }
    })
  ].join('\n');
  const byId = collectRequestUsage(parseTranscriptJsonl(text));
  assert(byId.get('r1')?.completion_tokens === 9, 'takes max streamed output per requestId');
  const first = turnUsageFromTranscript(text, { requests: {} });
  const again = turnUsageFromTranscript(text, { requests: first.nextRequests });
  assert(first.turnUsage?.total_tokens === 109, 'first transcript pass counts the request');
  assert(again.turnUsage == null, 'second pass does not double-count');
}

{
  const merged = mergeChatUsage(null, {
    prompt_tokens: 10,
    completion_tokens: 2,
    total_tokens: 12,
    source: 'provider',
    model: 'claude-sonnet-4-5'
  });
  assert(merged.ai_usage?.tool === 'claude-chat', 'merge tags tool claude-chat');
  assert(merged.ai_usage?.usage_source === 'provider', 'merge marks provider usage');
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
