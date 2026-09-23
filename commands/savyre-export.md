---
description: Export the Savyre workflow HTML report and open it in the browser. Use when the user runs /savyre-export.
---

# /savyre-export (Claude Code)

Export the same HTML report as **Export report** in the Savyre panel, then open it (Chrome preferred).

This is a **developer** action. Do not run it yourself unless they invoked this slash.

From the project workspace root:

```bash
node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" export
```

Windows PowerShell:

```powershell
node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs" export
```

Optional flags after `export`: `--no-open`, `--default-browser`.

## What to say

Speak JSON `userMessage` exactly. Do not paste JSON.

- Success: report path (`savyre/workflow-report.html`) and that the browser opened.
- Failure: speak `userMessage` — suggest panel **Export report** or Savyre CLI install. Do not invent a report.
- Does **not** end the session or unlock stages.
