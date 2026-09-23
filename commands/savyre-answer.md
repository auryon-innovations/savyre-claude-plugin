---
description: Save an Open Question answer from this chat. Use when the user runs /savyre-answer.
argument-hint: "[OQ-00N] their exact answer"
---

# /savyre-answer (Claude Code)

Use their exact words. Do not invent the answer.

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" answer $ARGUMENTS
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" answer $ARGUMENTS
```

Speak JSON `userMessage` exactly. If another question is pending, ask only that one next.
