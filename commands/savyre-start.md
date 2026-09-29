---
description: Bind this Claude Code chat to the current Savyre panel stage. Use when the user runs /savyre-start.
argument-hint: "[optional task leftover for Stage 01]"
---

# /savyre-start (Claude Code)

Same protocol as Cursor. Do not invent workflow rules.

**Speak JSON `userMessage` as the last line — exactly.** Do not paste JSON. Do not quote `message`. Follow `message` yourself. Do not mention `final.md`, `ai-output.md`, `developer-review.md`, artifact, or ACCEPTED. Never invent a Savyre panel task box, Send button, or panel Validate step — Chat has no panel capture UI.

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
4. **Stage 01 Task Definition (`s01-task-definition`) / Task Input (`01-task-input`) when `captureTask` is true:**
   - Extra words after `/savyre-start` are the product leftover. If JSON already has `suggestedTask`, `intakeReview`, or a captured product in `userMessage`, do **not** ask “What should we build?”
   - Write a 2–4 sentence restatement plus Product / UX / API / Data / Stack (only supported headings).
   - **Seven-stage:** save that **entire** text as `assignedTask` in `stages/s01_task_definition/stage_input.json` (not only `task_brief.md`).
   - **Legacy:** save under `## Assigned task` in `savyre/stages/01-task-input/input.md`.
   - Speak that same text, then speak `userMessage` exactly. Wait for `/savyre-next` to confirm. Do **not** write the brief/`ai-output.md` before confirm. Do **not** confirm for them.
   - Only if there is no leftover and Assigned task is empty: ask what to build once, wait, then write `assignedTask` as above.
5. On **Build & Review (`s04-build-review`)**: honor `nextBacklogItemId` — one item per turn. For TDD-required items run tests before code (RED) and after (GREEN) with `npm test`, `node --test`, or `pytest`. Do not invent lock while backlog remains.
6. Chat cannot approve or unlock. They continue with `/savyre-next`.
7. Extra words after start are Stage 01 leftover only when the panel is on Task Definition / Task Input.
8. If `mode` is `idle`, speak `userMessage`. Do not invent a workflow or turn the lock on yourself.
