/**
 * List-price USD / 1M tokens for Claude Chat hook cost accumulation.
 * Keep in sync with savyre-extension src/orchestrator/estimatedCost.ts.
 */

const MODEL_RATES = [
  { match: /fable|mythos/i, input: 10, output: 50 },
  { match: /opus[-_.]?4\.1|claude-opus-4-1/i, input: 15, output: 75 },
  { match: /opus/i, input: 5, output: 25 },
  { match: /haiku/i, input: 1, output: 5 },
  { match: /sonnet[-_.]?5\b|claude-sonnet-5/i, input: 2, output: 10 },
  { match: /sonnet/i, input: 3, output: 15 }
];

const DEFAULT_CLAUDE = { input: 2, output: 10 };

export function ratesForModel(model) {
  const id = String(model || '').trim();
  if (id) {
    for (const row of MODEL_RATES) {
      if (row.match.test(id)) return { input: row.input, output: row.output };
    }
  }
  return DEFAULT_CLAUDE;
}

export function estimateTurnCostUsd(promptTokens, completionTokens, model) {
  const prompt = Number(promptTokens);
  const completion = Number(completionTokens);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion < 0) {
    return null;
  }
  if (prompt === 0 && completion === 0) return 0;
  const rates = ratesForModel(model);
  return (prompt * rates.input + completion * rates.output) / 1_000_000;
}
