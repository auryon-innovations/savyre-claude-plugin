---
description: Clear the active Savyre execution lock. Use when the user runs /savyre-stop.
---

# /savyre-stop (Claude Code)

Does not accept the stage. Only clears Chat enforcement.

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" stop
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" stop
```

Speak `userMessage` if present. Do not claim the stage was accepted.
