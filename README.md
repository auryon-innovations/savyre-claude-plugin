# Savyre Claude Code plugin

Thin **Claude Code** adapter for the same Savyre Chat workflow used in Cursor.

- **Does not** invent stage methodology or a second brain
- Calls the shared **`savyre-guard.mjs`** from `savyre-cursor-plugin`
- Speaks the same JSON `userMessage` / `nextBacklogItemId` contract
- Ships the **full Cursor skills pack** + seven-stage candidate skills

**Version:** 0.2.1

## What you get

| Piece | Role |
|--------|------|
| `hooks/savyre-claude-hook.mjs` | Maps Claude Code hook events ↔ Cursor guard |
| `hooks/hooks.json` | Plugin hook registration |
| `commands/*.md` | `/savyre-start`, `/savyre-next`, `/savyre-turn`, `/savyre-answer`, `/savyre-stop`, `/savyre-status`, `/savyre-help`, `/savyre-export` |
| `skills/*` | Full role + capability skills (synced from Cursor) |
| `bundles/bundle_candidate_1/skills/*` | Seven-stage candidate skills |
| `scripts/savyre-cli.mjs` | Forwards CLI verbs to the shared guard |
| `scripts/install.mjs` | Project install (hooks + commands + skills) |
| `scripts/sync-skills.mjs` | Re-copy skills from Cursor plugin |
| `scripts/parity-matrix.mjs` | Stage/skill/command parity checks |
| `.claude-plugin/marketplace.json` | Local team marketplace catalog |

## Prerequisites

1. **Savyre extension** (panel) installed in VS Code/Cursor — stages, lock, validate
2. **`savyre-cursor-plugin`** available so the guard resolves (one of):
   - `Documents/Projects/savyre-cursor-plugin`
   - `~/.cursor/plugins/local/savyre-cursor-plugin`
   - or `SAVYRE_GUARD_PATH` pointing at `…/hooks/savyre-guard.mjs`
3. **Claude Code** CLI logged in (`claude auth login`)

## Install (project) — recommended

From any Savyre project (e.g. `test16`):

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/install.mjs" check
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/install.mjs" project .
```

This writes:

- `.claude/settings.local.json` — hook wiring
- `.claude/commands/*.md` — slash commands with absolute paths for this machine
- `.claude/skills/*` — full skills pack (15-stage + seven-stage)

Then open the project in **Claude Code** and use `/savyre-start`, `/savyre-next`, etc.

**You do not need** `claude --plugin-dir` when project install is done.

## Optional: plugin dir / marketplace

```powershell
claude --plugin-dir "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin"
```

Or local marketplace:

```text
/plugin marketplace add C:/Users/Ashish/Documents/Projects/savyre-claude-plugin
/plugin install savyre@savyre-marketplace
```

See [MARKETPLACE.md](./MARKETPLACE.md) for team distribute + public Anthropic directory submit steps.

## Smoke + parity

```powershell
node scripts/smoke-check.mjs
node --test scripts/test-claude-usage.mjs
node scripts/parity-matrix.mjs
node scripts/parity-matrix.mjs C:\path\to\savyre-project
```

Refresh skills after Cursor plugin updates:

```powershell
node scripts/sync-skills.mjs
node scripts/parity-matrix.mjs
```

## Chat protocol (same as Cursor)

1. Start a Savyre session in the **panel** (current stage set)
2. In Claude Code: `/savyre-start`
3. Speak only `userMessage`; follow `message` yourself
4. Developer continues with `/savyre-next`
5. On S04: implement one `nextBacklogItemId` at a time — do not invent lock while backlog remains

## Event map

| Claude Code | Cursor guard |
|-------------|--------------|
| `PreToolUse` (Bash/Edit/Write/…) | `preToolUse` |
| `PostToolUse` (Edit/Write/…) | `afterFileEdit` |
| `SessionStart` | `sessionStart` |
| `Stop` | `stop` + persist Chat tokens onto the current stage |
| `SubagentStop` | `stop` + persist Task-tool tokens onto the current stage |
| tool `Edit` | `StrReplace` (write gate) |

Claude Code does not put tokens on `Stop` stdin. The hook reads `transcript_path` JSONL (`message.usage`), counts each `requestId` once (max streamed `output_tokens`), and merges **provider** usage onto `savyre/stages/<current>/metadata.json` as `tool: claude-chat`. The extension sums those stages for the workflow total. List-price `estimated_cost_usd` is not Anthropic’s invoice. CLI `claude-cli` provider counts are never overwritten.

## Layout

```text
savyre-claude-plugin/
  .claude-plugin/plugin.json
  .claude-plugin/marketplace.json
  hooks/
  commands/
  skills/                          # full Cursor skill pack
  bundles/bundle_candidate_1/skills/
  scripts/
  MARKETPLACE.md
  README.md
```
