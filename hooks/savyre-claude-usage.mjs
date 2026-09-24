/**
 * Persist Claude Code Chat provider tokens onto the current Savyre stage.
 *
 * Claude Stop stdin does not include input_tokens / output_tokens. Actual usage
 * lives on conversation transcript JSONL (message.usage), keyed by requestId.
 * This module records only *new* request ids so each Stop adds a delta.
 *
 * Writes savyre/stages/<id>/metadata.json ai_usage (tool: claude-chat).
 * Does not overwrite CLI provider usage. Does not change the guard decision.
 */
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { estimateTurnCostUsd } from './tokenCostRates.mjs';

const SAVYRE_DIR = '.savyre';
const STATE_FILE = 'claude-chat-usage.json';
const CHAT_TOOL = 'claude-chat';
const CLI_PROVIDER_TOOLS = new Set([
  'cursor-cli',
  'copilot-cli',
  'claude-cli',
  'codex-cli',
  'savyre-server'
]);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nonNeg(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function mapClaudeUsageToTurn(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const inputTokens = nonNeg(raw.input_tokens);
  const outputTokens = nonNeg(raw.output_tokens);
  const cacheRead = nonNeg(raw.cache_read_input_tokens);
  const cacheWrite = nonNeg(raw.cache_creation_input_tokens);
  const prompt_tokens = inputTokens + cacheRead + cacheWrite;
  const completion_tokens = outputTokens;
  const total_tokens = prompt_tokens + completion_tokens;
  if (total_tokens <= 0) return null;
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens,
    source: 'provider'
  };
}

export function usageFromStopInput(input) {
  if (!input || typeof input !== 'object') return null;
  const nested = mapClaudeUsageToTurn(input.usage || input.token_usage || null);
  const top = mapClaudeUsageToTurn({
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    cache_read_input_tokens: input.cache_read_input_tokens,
    cache_creation_input_tokens: input.cache_creation_input_tokens
  });
  const counts = nested || top;
  if (!counts) return null;
  const model = String(input.model || input.model_id || input.usage?.model || '').trim() || null;
  return { ...counts, model };
}

function usageBagFromLine(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const message = obj.message && typeof obj.message === 'object' ? obj.message : null;
  const bag = (message && message.usage) || obj.usage || null;
  return bag && typeof bag === 'object' ? bag : null;
}

function requestKey(obj, lineIndex) {
  const id = String(obj?.requestId || obj?.request_id || obj?.message?.id || '').trim();
  return id || `line:${lineIndex}`;
}

function modelFromLine(obj) {
  const m = obj?.message?.model || obj?.model;
  return typeof m === 'string' && m.trim() ? m.trim() : null;
}

export function parseTranscriptJsonl(text) {
  const lines = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      /* skip malformed */
    }
  }
  return lines;
}

export function collectRequestUsage(lines) {
  const byId = new Map();
  const list = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < list.length; i++) {
    const obj = list[i];
    const bag = usageBagFromLine(obj);
    if (!bag) continue;
    const mapped = mapClaudeUsageToTurn(bag);
    if (!mapped) continue;
    const key = requestKey(obj, i);
    const model = modelFromLine(obj);
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, { ...mapped, model });
      continue;
    }
    const completion = Math.max(prev.completion_tokens, mapped.completion_tokens);
    byId.set(key, {
      prompt_tokens: prev.prompt_tokens,
      completion_tokens: completion,
      total_tokens: prev.prompt_tokens + completion,
      source: 'provider',
      model: model || prev.model
    });
  }
  return byId;
}

export function deltaUsageFromRequests(byId, sessionState) {
  const recorded = sessionState && typeof sessionState === 'object' ? sessionState.requests || {} : {};
  let prompt = 0;
  let completion = 0;
  let model = null;
  const nextRequests = { ...recorded };
  const newIds = [];
  const entries = byId instanceof Map ? byId.entries() : Object.entries(byId || {});
  for (const [id, usage] of entries) {
    if (!usage || !num(usage.total_tokens)) continue;
    const prior = recorded[id];
    if (!prior) {
      prompt += usage.prompt_tokens;
      completion += usage.completion_tokens;
      nextRequests[id] = {
        prompt_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens
      };
      newIds.push(id);
      model = usage.model || model;
      continue;
    }
    const extraOut = Math.max(0, usage.completion_tokens - (Number(prior.output_tokens) || 0));
    if (extraOut > 0) {
      completion += extraOut;
      nextRequests[id] = { ...prior, output_tokens: usage.completion_tokens };
      model = usage.model || model;
    }
  }
  const total_tokens = prompt + completion;
  if (total_tokens <= 0) {
    return { turnUsage: null, nextRequests, newIds };
  }
  return {
    turnUsage: {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens,
      source: 'provider',
      model
    },
    nextRequests,
    newIds
  };
}

export function shouldSkipChatUsage(existing, turnUsage) {
  if (!existing || typeof existing !== 'object') return false;
  if (!turnUsage || !num(turnUsage.total_tokens)) return true;
  const tool = String(existing.tool || '').trim();
  if (CLI_PROVIDER_TOOLS.has(tool) && num(existing.total_tokens) > 0) return true;
  return existing.usage_source === 'provider' && turnUsage.source !== 'provider';
}

export function mergeChatUsage(existing, turnUsage) {
  const current = existing && typeof existing === 'object' ? existing : {};
  if (shouldSkipChatUsage(current, turnUsage)) {
    return { skipped: true, ai_usage: current };
  }
  if (!turnUsage || !num(turnUsage.total_tokens)) {
    return { skipped: true, ai_usage: current };
  }
  const nextPrompt = num(current.prompt_tokens) + turnUsage.prompt_tokens;
  const nextCompletion = num(current.completion_tokens) + turnUsage.completion_tokens;
  const nextTotal = num(current.total_tokens) + turnUsage.total_tokens;
  const source =
    current.usage_source === 'provider' || turnUsage.source === 'provider' ? 'provider' : 'estimated';
  const turnModel = String(turnUsage.model || '').trim() || current.model || null;
  const turnCost = estimateTurnCostUsd(
    turnUsage.prompt_tokens,
    turnUsage.completion_tokens,
    turnModel
  );
  const prevCost = Number(current.estimated_cost_usd);
  const nextCost =
    turnCost == null
      ? Number.isFinite(prevCost)
        ? prevCost
        : null
      : (Number.isFinite(prevCost) ? prevCost : 0) + turnCost;
  return {
    skipped: false,
    ai_usage: {
      tool: CHAT_TOOL,
      model: turnModel,
      prompt_tokens: nextPrompt,
      completion_tokens: nextCompletion,
      total_tokens: nextTotal,
      usage_source: source,
      estimated_cost_usd: nextCost,
      ai_calls: (Number(current.ai_calls) || 0) + 1,
      cli_exit_code: current.cli_exit_code ?? null,
      cli_stdout_length: current.cli_stdout_length ?? null,
      cli_prompt_length: current.cli_prompt_length ?? null
    }
  };
}

export function stageIdFromRelPath(rel) {
  const n = String(rel || '').replace(/\\/g, '/');
  let m = n.match(/^stages\/(s0\d_[^/]+)\//);
  if (m) return m[1].replace(/_/g, '-');
  m = n.match(/^savyre\/stages\/([^/]+)\//);
  if (m) return m[1];
  return null;
}

export function findRepoRoot(raw, cursorInput) {
  const roots = [];
  if (cursorInput?.cwd) roots.push(cursorInput.cwd);
  if (raw?.cwd) roots.push(raw.cwd);
  if (process.env.CLAUDE_PROJECT_DIR) roots.push(process.env.CLAUDE_PROJECT_DIR);
  if (Array.isArray(raw?.workspace_roots)) roots.push(...raw.workspace_roots);
  if (Array.isArray(cursorInput?.workspace_roots)) roots.push(...cursorInput.workspace_roots);
  roots.push(process.cwd());

  for (const root of roots) {
    if (!root || typeof root !== 'string') continue;
    let dir = path.resolve(root);
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, SAVYRE_DIR))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

async function readJson(abs) {
  try {
    return JSON.parse(await fs.readFile(abs, 'utf8'));
  } catch {
    return null;
  }
}

async function loadUsageState(repoRoot) {
  const doc = await readJson(path.join(repoRoot, SAVYRE_DIR, STATE_FILE));
  if (doc && typeof doc === 'object' && doc.sessions && typeof doc.sessions === 'object') {
    return doc;
  }
  return { sessions: {} };
}

async function saveUsageState(repoRoot, state) {
  const dir = path.join(repoRoot, SAVYRE_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function resolveCurrentStageId(repoRoot) {
  const status = await readJson(path.join(repoRoot, SAVYRE_DIR, 'stage-status.json'));
  const fromStatus = String(status?.currentStageId || '').trim();
  if (fromStatus) return fromStatus;
  const repoMeta = await readJson(path.join(repoRoot, 'savyre', 'metadata.json'));
  return String(repoMeta?.current_stage_id || repoMeta?.current_stage || '').trim() || null;
}

export function stageMetadataCandidates(repoRoot, stageId) {
  const id = String(stageId || '').trim();
  if (!id) return [];
  const folder = id.replace(/-/g, '_');
  return [
    path.join(repoRoot, 'savyre', 'stages', id, 'metadata.json'),
    path.join(repoRoot, 'stages', folder, 'metadata.json')
  ];
}

export async function recordChatUsageOnStage(repoRoot, stageId, turnUsage) {
  if (!stageId || !turnUsage?.total_tokens) return { recorded: false, reason: 'no-stage-or-usage' };
  const repoMeta = await readJson(path.join(repoRoot, 'savyre', 'metadata.json'));
  const listed = Array.isArray(repoMeta?.stages)
    ? repoMeta.stages.find((s) => s && (s.stage_key === stageId || s.stage_key === String(stageId)))
    : null;
  const candidates = [];
  if (listed?.metadata_path) {
    candidates.push(path.join(repoRoot, ...String(listed.metadata_path).split('/')));
  }
  candidates.push(...stageMetadataCandidates(repoRoot, stageId));

  const seen = new Set();
  for (const abs of candidates) {
    const key = path.resolve(abs);
    if (seen.has(key)) continue;
    seen.add(key);
    const doc = await readJson(abs);
    if (!doc || typeof doc !== 'object') continue;
    const merged = mergeChatUsage(doc.ai_usage, turnUsage);
    if (merged.skipped) {
      return { recorded: false, reason: 'provider-usage-kept', path: abs };
    }
    doc.ai_usage = merged.ai_usage;
    doc.updated_at = new Date().toISOString();
    await fs.writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return { recorded: true, path: abs, ai_usage: merged.ai_usage };
  }
  return { recorded: false, reason: 'metadata-missing' };
}

async function readTranscriptWithRetry(abs, { retries = 1, delayMs = 300 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await fs.readFile(abs, 'utf8');
      if (text.trim() || attempt === retries) return text;
    } catch {
      if (attempt === retries) return '';
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return '';
}

export function turnUsageFromTranscript(text, sessionState) {
  const lines = parseTranscriptJsonl(text);
  const byId = collectRequestUsage(lines);
  return deltaUsageFromRequests(byId, sessionState);
}

export async function recordClaudeChatUsageFromHook(raw, cursorInput) {
  const repoRoot = findRepoRoot(raw, cursorInput);
  if (!repoRoot) return { recorded: false, reason: 'no-repo' };

  const sessionId = String(raw?.session_id || raw?.sessionId || cursorInput?.session_id || 'unknown').trim();
  const transcriptPath = String(raw?.transcript_path || raw?.transcriptPath || '').trim();

  const state = await loadUsageState(repoRoot);
  const session = state.sessions[sessionId] && typeof state.sessions[sessionId] === 'object'
    ? state.sessions[sessionId]
    : { requests: {} };

  let turnUsage = null;
  let nextRequests = session.requests || {};

  if (transcriptPath) {
    const text = await readTranscriptWithRetry(transcriptPath);
    const delta = turnUsageFromTranscript(text, session);
    turnUsage = delta.turnUsage;
    nextRequests = delta.nextRequests;
  } else {
    const stdinUsage = usageFromStopInput(raw);
    if (stdinUsage) {
      const key = `stdin:${stdinUsage.prompt_tokens}:${stdinUsage.completion_tokens}:${stdinUsage.total_tokens}`;
      if (!(session.requests || {})[key]) {
        turnUsage = stdinUsage;
        nextRequests = {
          ...(session.requests || {}),
          [key]: {
            prompt_tokens: stdinUsage.prompt_tokens,
            output_tokens: stdinUsage.completion_tokens
          }
        };
      }
    }
  }

  state.sessions[sessionId] = {
    transcript_path: transcriptPath || session.transcript_path || null,
    requests: nextRequests
  };
  await saveUsageState(repoRoot, state);

  if (!turnUsage || !turnUsage.total_tokens) {
    return { recorded: false, reason: 'no-new-usage', repoRoot, sessionId };
  }

  const stageId = await resolveCurrentStageId(repoRoot);
  const recorded = await recordChatUsageOnStage(repoRoot, stageId, turnUsage);
  return { ...recorded, stageId, usage: turnUsage, repoRoot, sessionId };
}
