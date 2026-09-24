import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const usageHref = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'savyre-claude-usage.mjs')
).href;
const usage = await import(usageHref);

function assistantLine({ requestId, model, input, output, cacheRead = 0, cacheWrite = 0, messageId }) {
  return JSON.stringify({
    type: 'assistant',
    requestId,
    message: {
      id: messageId || `msg_${requestId}`,
      model,
      usage: {
        input_tokens: input,
        output_tokens: output,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheWrite
      }
    }
  });
}

test('maps Claude usage including cache into prompt tokens', () => {
  const turn = usage.mapClaudeUsageToTurn({
    input_tokens: 100,
    output_tokens: 20,
    cache_read_input_tokens: 80,
    cache_creation_input_tokens: 5
  });
  assert.deepEqual(turn, {
    prompt_tokens: 185,
    completion_tokens: 20,
    total_tokens: 205,
    source: 'provider'
  });
});

test('dedupes requestId lines and takes max streamed output', () => {
  const text = [
    assistantLine({ requestId: 'req_a', model: 'claude-sonnet-4-5', input: 1000, output: 10 }),
    assistantLine({ requestId: 'req_a', model: 'claude-sonnet-4-5', input: 1000, output: 40 }),
    assistantLine({ requestId: 'req_b', model: 'claude-sonnet-4-5', input: 200, output: 5, cacheRead: 50 })
  ].join('\n');
  const byId = usage.collectRequestUsage(usage.parseTranscriptJsonl(text));
  assert.equal(byId.get('req_a').prompt_tokens, 1000);
  assert.equal(byId.get('req_a').completion_tokens, 40);
  assert.equal(byId.get('req_b').prompt_tokens, 250);
  assert.equal(byId.get('req_b').completion_tokens, 5);
});

test('second Stop only records new request ids and output deltas', () => {
  const firstText = [
    assistantLine({ requestId: 'req_a', model: 'claude-opus-4', input: 1000, output: 20 })
  ].join('\n');
  const first = usage.turnUsageFromTranscript(firstText, { requests: {} });
  assert.equal(first.turnUsage.prompt_tokens, 1000);
  assert.equal(first.turnUsage.completion_tokens, 20);
  assert.equal(first.turnUsage.total_tokens, 1020);
  assert.equal(first.turnUsage.model, 'claude-opus-4');

  const sameAgain = usage.turnUsageFromTranscript(firstText, { requests: first.nextRequests });
  assert.equal(sameAgain.turnUsage, null);

  const secondText = [
    assistantLine({ requestId: 'req_a', model: 'claude-opus-4', input: 1000, output: 30 }),
    assistantLine({ requestId: 'req_b', model: 'claude-opus-4', input: 100, output: 10 })
  ].join('\n');
  const second = usage.turnUsageFromTranscript(secondText, { requests: first.nextRequests });
  assert.equal(second.turnUsage.prompt_tokens, 100);
  assert.equal(second.turnUsage.completion_tokens, 20);
  assert.equal(second.turnUsage.total_tokens, 120);
});

test('merge writes claude-chat and never overwrites CLI provider tokens', () => {
  const first = usage.mergeChatUsage(
    { tool: null, prompt_tokens: null, completion_tokens: null, total_tokens: null },
    {
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
      total_tokens: 1_000_000,
      source: 'provider',
      model: 'claude-sonnet-5'
    }
  );
  assert.equal(first.skipped, false);
  assert.equal(first.ai_usage.tool, 'claude-chat');
  assert.equal(first.ai_usage.usage_source, 'provider');
  assert.equal(first.ai_usage.estimated_cost_usd, 2);

  const kept = usage.mergeChatUsage(
    {
      tool: 'claude-cli',
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      usage_source: 'provider'
    },
    { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10, source: 'provider' }
  );
  assert.equal(kept.skipped, true);
  assert.equal(kept.ai_usage.tool, 'claude-cli');
  assert.equal(kept.ai_usage.total_tokens, 120);
});

test('Stop persist writes provider tokens onto the current stage', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'savyre-claude-tokens-'));
  try {
    const stageDir = path.join(root, 'savyre', 'stages', '01-task-input');
    await mkdir(path.join(root, '.savyre'), { recursive: true });
    await mkdir(stageDir, { recursive: true });
    await writeFile(
      path.join(root, '.savyre', 'stage-status.json'),
      JSON.stringify({ currentStageId: '01-task-input' }),
      'utf8'
    );
    await writeFile(
      path.join(stageDir, 'metadata.json'),
      JSON.stringify({
        stage_key: '01-task-input',
        ai_usage: { tool: null, model: null, prompt_tokens: null, completion_tokens: null, total_tokens: null }
      }),
      'utf8'
    );
    const transcript = path.join(root, 'transcript.jsonl');
    await writeFile(
      transcript,
      `${assistantLine({
        requestId: 'req_1',
        model: 'claude-sonnet-4-5',
        input: 500,
        output: 25,
        cacheRead: 100
      })}\n`,
      'utf8'
    );

    const first = await usage.recordClaudeChatUsageFromHook(
      { session_id: 'sess-1', transcript_path: transcript, cwd: root },
      { cwd: root, session_id: 'sess-1' }
    );
    assert.equal(first.recorded, true);
    assert.equal(first.stageId, '01-task-input');
    assert.equal(first.usage.total_tokens, 625);
    assert.equal(first.usage.source, 'provider');

    const meta = JSON.parse(await readFile(path.join(stageDir, 'metadata.json'), 'utf8'));
    assert.equal(meta.ai_usage.tool, 'claude-chat');
    assert.equal(meta.ai_usage.usage_source, 'provider');
    assert.equal(meta.ai_usage.prompt_tokens, 600);
    assert.equal(meta.ai_usage.completion_tokens, 25);
    assert.equal(meta.ai_usage.total_tokens, 625);
    assert.equal(meta.ai_usage.model, 'claude-sonnet-4-5');
    assert.equal(meta.ai_usage.ai_calls, 1);

    const second = await usage.recordClaudeChatUsageFromHook(
      { session_id: 'sess-1', transcript_path: transcript, cwd: root },
      { cwd: root }
    );
    assert.equal(second.recorded, false);
    const meta2 = JSON.parse(await readFile(path.join(stageDir, 'metadata.json'), 'utf8'));
    assert.equal(meta2.ai_usage.total_tokens, 625);
    assert.equal(meta2.ai_usage.ai_calls, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
