# Marketplace / distribution

This repo is both the **plugin** and a **local marketplace** catalog.

## Local team install (no Anthropic review)

From Claude Code:

```text
/plugin marketplace add C:/Users/Ashish/Documents/Projects/savyre-claude-plugin
/plugin install savyre@savyre-marketplace
```

Or CLI:

```bash
claude plugin marketplace add "/path/to/savyre-claude-plugin"
claude plugin install savyre@savyre-marketplace
```

Validate before sharing:

```bash
claude plugin validate .
node scripts/parity-matrix.mjs
```

## Project install (no marketplace)

Still supported — copies hooks, commands, and skills into the project:

```bash
node scripts/install.mjs project /path/to/your-project
```

## Public Anthropic plugin directory (optional)

Requires a **public** GitHub repo of this plugin, then submit at:
https://clau.de/plugin-directory-submission

Before submit:

1. `claude plugin validate .` passes
2. Repo is public and contains `.claude-plugin/plugin.json`
3. Version bumped in `plugin.json` + `marketplace.json`

Updates after approval follow the GitHub repo automatically (no re-submit for routine version bumps).

## Sync skills from Cursor

When Cursor role skills change:

```bash
node scripts/sync-skills.mjs
node scripts/parity-matrix.mjs
```
