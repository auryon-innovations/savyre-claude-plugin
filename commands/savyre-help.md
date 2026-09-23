---
description: List Savyre Claude Code slash commands and when to use them. Use when the user runs /savyre-help.
---

# /savyre-help (Claude Code)

Show this list to the developer. Do not invent extra workflow rules. Panel Accept / Generate final / Validate stay in the Savyre panel.

## Slash commands

| Command | When to use |
|---------|-------------|
| `/savyre-help` | This list |
| `/savyre-status` | Check idle vs enforced / current stage |
| `/savyre-start` | Bind this chat to the panel's current stage |
| `/savyre-turn` | Reload the current turn from the guard |
| `/savyre-next` | Continue (confirm, implement next backlog id, lock, or validate) |
| `/savyre-answer` | Save an answer to an open question (`OQ-00N …`) |
| `/savyre-export` | Export HTML workflow report and open in browser (same as panel Export report) |
| `/savyre-stop` | Clear the chat lock only (does not accept the stage) |

## Protocol (short)

1. Start or set the stage in the **Savyre panel**.
2. In Claude Code: `/savyre-start`.
3. Speak only JSON `userMessage` as the last line. Follow `message` yourself. Do not paste JSON.
4. Developer continues with `/savyre-next`.
5. On Build & Review: one `nextBacklogItemId` per turn — do not invent lock while backlog remains.

## Optional CLI

Same verbs via:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" status
```

After listing the table, ask them which command to run next (usually `/savyre-status` or `/savyre-start`).
