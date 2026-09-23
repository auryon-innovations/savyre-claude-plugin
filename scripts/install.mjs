#!/usr/bin/env node
/**
 * Install / register helpers for local Claude Code use.
 *
 * Modes:
 *   node scripts/install.mjs print-settings   → JSON fragment for .claude/settings.json
 *   node scripts/install.mjs project [dir]    → write hooks + commands + skills into a project
 *   node scripts/install.mjs check            → verify guard + hook adapter resolve
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveGuardPath, pluginRoot } from '../hooks/resolveGuard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const hookAbs = path.join(ROOT, 'hooks', 'savyre-claude-hook.mjs');
const cliAbs = path.join(ROOT, 'scripts', 'savyre-cli.mjs');
const hookCmd = `node "${hookAbs.replace(/\\/g, '/')}"`;
const cliCmd = `node "${cliAbs.replace(/\\/g, '/')}"`;

function copySkillTrees(skillsDir) {
  mkdirSync(skillsDir, { recursive: true });
  const sources = [
    path.join(ROOT, 'skills'),
    path.join(ROOT, 'bundles', 'bundle_candidate_1', 'skills')
  ];
  let count = 0;
  for (const src of sources) {
    if (!existsSync(src)) continue;
    for (const name of readdirSync(src, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      if (name.name.startsWith('.')) continue;
      const from = path.join(src, name.name);
      const to = path.join(skillsDir, name.name);
      if (existsSync(to)) rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
      count += 1;
    }
  }
  return count;
}

function hooksConfig() {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit',
          hooks: [{ type: 'command', command: hookCmd }]
        }
      ],
      PostToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit|NotebookEdit',
          hooks: [{ type: 'command', command: hookCmd }]
        }
      ],
      SessionStart: [{ hooks: [{ type: 'command', command: hookCmd }] }],
      Stop: [{ hooks: [{ type: 'command', command: hookCmd }] }]
    }
  };
}

function printSettings() {
  process.stdout.write(`${JSON.stringify(hooksConfig(), null, 2)}\n`);
}

function rewriteCommandMarkdown(text) {
  return String(text || '')
    .replaceAll(
      'node "$HOME/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs"',
      cliCmd
    )
    .replaceAll(
      'node "$env:USERPROFILE/Documents/Projects/savyre-claude-plugin/scripts/savyre-cli.mjs"',
      cliCmd
    );
}

function installProject(targetDir) {
  const root = path.resolve(targetDir || process.cwd());
  const claudeDir = path.join(root, '.claude');
  const commandsDir = path.join(claudeDir, 'commands');
  const skillsDir = path.join(claudeDir, 'skills');
  mkdirSync(commandsDir, { recursive: true });

  const settingsPath = path.join(claudeDir, 'settings.local.json');
  let existing = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  const cfg = hooksConfig();
  const next = { ...existing, hooks: { ...(existing.hooks || {}), ...cfg.hooks } };
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  const srcCommands = path.join(ROOT, 'commands');
  for (const name of readdirSync(srcCommands)) {
    if (!name.endsWith('.md')) continue;
    const body = rewriteCommandMarkdown(readFileSync(path.join(srcCommands, name), 'utf8'));
    writeFileSync(path.join(commandsDir, name), body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  }

  const skillCount = copySkillTrees(skillsDir);
  const uniqueSkills = existsSync(skillsDir)
    ? readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0;

  process.stdout.write(`Wrote ${settingsPath}\n`);
  process.stdout.write(`Wrote slash commands under ${commandsDir}\n`);
  process.stdout.write(`Wrote ${uniqueSkills} unique skills under ${skillsDir} (${skillCount} trees copied)\n`);
  process.stdout.write(`Plugin root: ${ROOT}\n`);
  process.stdout.write(`Guard: ${resolveGuardPath() || 'MISSING — install savyre-cursor-plugin'}\n`);
  process.stdout.write(
    'Enable: open this project in Claude Code (hooks load from .claude/settings.local.json).\n'
  );
  process.stdout.write(`Optional plugin load: claude --plugin-dir "${ROOT.replace(/\\/g, '/')}"\n`);
  process.stdout.write(
    `Optional marketplace: /plugin marketplace add "${ROOT.replace(/\\/g, '/')}" then /plugin install savyre@savyre-marketplace\n`
  );
}

function check() {
  const guard = resolveGuardPath();
  const hook = path.join(ROOT, 'hooks', 'savyre-claude-hook.mjs');
  const ok = Boolean(guard && existsSync(hook));
  process.stdout.write(
    JSON.stringify(
      {
        ok,
        pluginRoot: pluginRoot(),
        guardPath: guard,
        hookPath: hook,
        home: os.homedir()
      },
      null,
      2
    ) + '\n'
  );
  process.exit(ok ? 0 : 1);
}

const verb = process.argv[2] || 'check';
if (verb === 'print-settings') printSettings();
else if (verb === 'project') installProject(process.argv[3]);
else if (verb === 'check') check();
else {
  process.stderr.write('Usage: node scripts/install.mjs check|print-settings|project [dir]\n');
  process.exit(2);
}
