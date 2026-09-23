---
description: Bind this Claude Code chat to the current Savyre panel stage. Use when the user runs /savyre-start.
argument-hint: "[optional task leftover for Stage 01]"
---

# /savyre-start (Claude Code)

Same protocol as Cursor. Do not invent workflow rules.

**Speak JSON `userMessage` as the last line — exactly.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `developer-review.md`, artifact, or ACCEPTED.

Bind **this** chat to the Savyre session's **current** stage (the panel). Chat performs that stage and saves output locally. Then **ask** them to run the slash in `userMessage`. After `/savyre-start`, that slash is always `/savyre-next`. `/savyre-stop` only clears the lock. Do not run those commands yourself.

1. From the **project** workspace root, run:

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" start $ARGUMENTS
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" start $ARGUMENTS
```

2. Follow `stageId`, `captureTask`, `turn.state`, `turn.activeSkill`, `cursorSkill`, and `allowedActions`. If JSON `unifiedTurn` is present, that is the current outcome and next action. Do not invent a different next step. Use skill `cursorSkill`. If `turn.question` or `pendingQuestion` is set, ask **only that question**. If JSON `intervention.ask` is false, do **not** invent another question.
3. Then run `turn` the same way and follow `turn.activeSkill` / `cursorSkill` / `allowedActions`.
4. On Build & Review: honor `nextBacklogItemId` — one item per turn. Do not invent lock while backlog remains.
5. Chat cannot approve or unlock. They continue with `/savyre-next`.
6. Extra words after start are Stage 01 leftover only when the panel is on Task Definition / Task Input.
7. If `mode` is `idle`, speak `userMessage`. Do not invent a workflow or turn the lock on yourself.
