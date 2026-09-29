---
description: Continue the current Savyre Chat step (confirm, implement next backlog id, lock, or validate). Use when the user runs /savyre-next.
---

# /savyre-next (Claude Code)

Same protocol as Cursor. This is a **developer** action. Do not run it yourself unless they invoked this slash.

`/savyre-next` is the only continue command. Speak JSON `userMessage` exactly. Never invent “Please check … to lock …” while backlog items remain. Never invent a Savyre panel task box, Send button, or panel Validate step.

From the project workspace root:

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" next
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" next
```

## What to say

**Talk first, then speak JSON `userMessage` as the last line — exactly as returned.** Do not paste JSON. Do not invent a next step.

- Before confirm: if `assignedTask` is empty, write the product restatement into `stages/s01_task_definition/stage_input.json`, speak it, then speak `userMessage`. Do not send them to the panel.
- After any stage write: 1–2 sentences of substance, then speak `userMessage` **exactly**.
- `userMessage` may say confirm, implement the next backlog id, answer an open question, check a draft, **or** lock — copy it verbatim. Never replace it with a canned “Please check … to lock …” line.
- On **Build & Review (S04)**: if JSON has `nextBacklogItemId` or `userMessage` says implement an id, do that work with TDD when required (`npm test` / `node --test` / `pytest` for RED then GREEN). **Do not** say lock Build & Review while backlog items remain.
- Do not quote `message`. Follow `message` yourself.

1. Speak `userMessage`. Wait. Do not run `/savyre-next` again yourself.
2. After Task Definition confirm, write `task_brief.md` if `message` asks, run `turn`, talk, then speak `userMessage`. Do not send the user to the Savyre panel for `/savyre-next`.
3. Chat cannot unlock. Do not claim the next stage is accepted.
