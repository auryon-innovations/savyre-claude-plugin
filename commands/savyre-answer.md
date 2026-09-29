---
description: Save an Open Question answer from this chat. Use when the user runs /savyre-answer.
argument-hint: "[OQ-00N] their exact answer"
---

# /savyre-answer (Claude Code)

Same protocol as Cursor. Use their exact words. Do not invent the answer. Do not edit `developer-review.md` yourself.

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" answer $ARGUMENTS
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" answer $ARGUMENTS
```

If the pending question id is already in the turn, you may omit the id and pass only their words.

## What to say

**Speak JSON `userMessage` exactly as the last line.** Do not paste JSON. Do not quote `message`. Follow `message` yourself.

1. If `ok` is false because Chat bind ≠ panel, speak `userMessage` and **wait**. Do not save the answer.
2. If `nextQuestion` is set, ask **only** that question next (`userMessage`).
3. If no questions remain, speak `userMessage` and **wait** for `/savyre-next`. Do not run that slash yourself.
