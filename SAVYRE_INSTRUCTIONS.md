# Savyre AI Coding Workflow

You are running the **Savyre 13-stage AI coding workflow** in this project.

Savyre is a workflow layer around Cursor, Copilot, and other AI tools — not a replacement for them.

## Rules

1. Complete stages in order unless your config allows skipping.
2. Save stage outputs under `savyre/stages/<stage-id>/`.
3. Do not edit protected Savyre files during an active session.
4. Use the Savyre panel or `savyre workflow` CLI to track progress.

## Per-stage files

All stages use the same artifact pattern:

`input.md` (Stage 01 human; Stage 02+ auto from prior `final.md`), `ai-output.md`, `developer-review.md` (02+), `final.md` (completion SoT), `metadata.json`

Flow: Input → Generate Output → (02+) Developer review → Generate Final → next stage input auto-seeded

## Stages

Understand → plan → implement → review → test → review (15 steps). Open the Savyre sidebar panel for the current stage prompt.
