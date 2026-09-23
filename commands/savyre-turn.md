---
description: Refresh the authoritative Savyre InteractiveTurn. Use when the user runs /savyre-turn.
---

# /savyre-turn (Claude Code)

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" turn
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" turn
```

Speak `userMessage` exactly. Follow `turn.activeSkill` / `message`. Do not invent lock or unlock.
