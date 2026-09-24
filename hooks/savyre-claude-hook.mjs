#!/usr/bin/env node
/**
 * Claude Code ↔ Savyre guard adapter.
 *
 * Claude Code sends hook JSON on stdin (hook_event_name, tool_name, tool_input, cwd).
 * This process normalizes that into the Cursor guard shape, runs savyre-guard.mjs in
 * hook mode, then maps the guard response back to Claude Code's hookSpecificOutput /
 * decision format.
 *
 * No Savyre methodology lives here — enforcement stays in the shared guard.
 * Stop / SubagentStop also persist Claude transcript tokens onto the current stage.
 */
import { spawnSync } from 'child_process';
import { resolveGuardPath } from './resolveGuard.mjs';
import { recordClaudeChatUsageFromHook } from './savyre-claude-usage.mjs';

const EVENT_MAP = {
  PreToolUse: 'preToolUse',
  PostToolUse: 'afterFileEdit',
  SessionStart: 'sessionStart',
  Stop: 'stop',
  SubagentStop: 'stop'
};

const TOOL_MAP = {
  Edit: 'StrReplace',
  MultiEdit: 'StrReplace',
  NotebookEdit: 'EditNotebook',
  Bash: 'Bash',
  PowerShell: 'Bash',
  Write: 'Write',
  Read: 'Read'
};

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function claudeEvent(raw) {
  return String(raw?.hook_event_name || raw?.hookEventName || '').trim();
}

function normalizeToolName(name) {
  const n = String(name || '').trim();
  return TOOL_MAP[n] || n;
}

function filePathFromClaude(raw) {
  const ti = raw?.tool_input || {};
  return (
    ti.file_path ||
    ti.path ||
    ti.target_notebook ||
    ti.notebook_path ||
    raw?.file_path ||
    ''
  );
}

function commandFromClaude(raw) {
  const ti = raw?.tool_input || {};
  return String(ti.command || raw?.command || '').trim();
}

/** Build Cursor-shaped hook input from Claude Code stdin JSON. */
export function toCursorHookInput(raw) {
  const event = claudeEvent(raw);
  const mappedEvent = EVENT_MAP[event] || event.toLowerCase();
  const toolName = normalizeToolName(raw?.tool_name || raw?.toolName);
  const toolInput = raw?.tool_input && typeof raw.tool_input === 'object' ? { ...raw.tool_input } : {};
  const filePath = filePathFromClaude(raw);
  if (filePath && !toolInput.path && !toolInput.file_path) {
    toolInput.path = filePath;
    toolInput.file_path = filePath;
  }
  const command = commandFromClaude(raw);
  if (command && !toolInput.command) toolInput.command = command;

  return {
    hook_event_name: mappedEvent,
    hookEventName: mappedEvent,
    tool_name: toolName,
    tool: toolName,
    tool_input: toolInput,
    file_path: filePath,
    command,
    cwd: raw?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    session_id: raw?.session_id || raw?.sessionId || null,
    workspace_roots: raw?.workspace_roots || undefined
  };
}

/** Map Cursor guard stdout JSON → Claude Code hook response. */
export function toClaudeHookOutput(cursorOut, claudeEventName) {
  const event = String(claudeEventName || 'PreToolUse');
  if (!cursorOut || typeof cursorOut !== 'object') {
    return emptyAllow(event);
  }

  if (cursorOut.permission === 'deny') {
    const reason = String(
      cursorOut.agent_message || cursorOut.user_message || 'Blocked by Savyre stage lock.'
    );
    if (event === 'PreToolUse') {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason
        }
      };
    }
    return { decision: 'block', reason };
  }

  if (typeof cursorOut.additional_context === 'string' && cursorOut.additional_context.trim()) {
    return {
      hookSpecificOutput: {
        hookEventName: event === 'sessionStart' || event === 'SessionStart' ? 'SessionStart' : event,
        additionalContext: cursorOut.additional_context.trim()
      }
    };
  }

  if (typeof cursorOut.followup_message === 'string' && cursorOut.followup_message.trim()) {
    return {
      decision: 'block',
      reason: cursorOut.followup_message.trim(),
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: cursorOut.followup_message.trim()
      }
    };
  }

  if (cursorOut.permission === 'allow' || Object.keys(cursorOut).length === 0) {
    return emptyAllow(event);
  }

  // Unknown / idle payloads: allow tool use, optionally pass context.
  if (typeof cursorOut.userMessage === 'string' && cursorOut.userMessage.trim() && event === 'SessionStart') {
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Savyre: ${cursorOut.userMessage.trim()}`
      }
    };
  }

  return emptyAllow(event);
}

function emptyAllow(event) {
  if (event === 'PreToolUse') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    };
  }
  return {};
}

function runGuardHook(cursorInput) {
  const guard = resolveGuardPath();
  if (!guard) {
    return {
      ok: false,
      missing: true,
      message:
        'Savyre guard not found. Install savyre-cursor-plugin next to this pack, or set SAVYRE_GUARD_PATH.'
    };
  }
  const result = spawnSync(process.execPath, [guard], {
    input: `${JSON.stringify(cursorInput)}\n`,
    encoding: 'utf8',
    cwd: cursorInput.cwd || process.cwd(),
    env: process.env,
    timeout: 60000
  });
  const raw = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (!raw) {
    return { permission: 'allow' };
  }
  // Guard prints one JSON object (possibly with trailing noise).
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* try previous line */
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { permission: 'allow' };
  }
}

async function main() {
  const rawText = await readStdin();
  if (!rawText.trim()) {
    writeJson({});
    process.exit(0);
  }
  let raw;
  try {
    raw = JSON.parse(rawText);
  } catch {
    writeJson({});
    process.exit(0);
  }

  const event = claudeEvent(raw) || 'PreToolUse';
  const cursorInput = toCursorHookInput(raw);

  if (event === 'Stop' || event === 'SubagentStop') {
    try {
      await recordClaudeChatUsageFromHook(raw, cursorInput);
    } catch (err) {
      process.stderr.write(`[savyre-claude-usage] ${err?.stack || err}\n`);
    }
  }

  const cursorOut = runGuardHook(cursorInput);

  if (cursorOut?.missing) {
    if (event === 'PreToolUse') {
      writeJson({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: cursorOut.message
        },
        systemMessage: cursorOut.message
      });
    } else if (event === 'SessionStart') {
      writeJson({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: cursorOut.message
        }
      });
    } else {
      writeJson({});
    }
    process.exit(0);
  }

  writeJson(toClaudeHookOutput(cursorOut, event));
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('savyre-claude-hook.mjs') ||
    process.argv[1].includes('savyre-claude-hook'));

if (isMain) {
  main().catch((err) => {
    process.stderr.write(String(err?.stack || err) + '\n');
    process.exit(0);
  });
}
