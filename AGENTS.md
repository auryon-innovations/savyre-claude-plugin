# Savyre AI Workflow Instructions for OpenAI Codex

You are assisting inside a Savyre AI Coding Workflow.
Savyre evaluates responsible AI-assisted development. Your role is to help the developer at the active lifecycle
stage while preserving developer ownership.

## Core Rules

- Follow the current Savyre stage.
- Do not skip stages.
- Do not perform implementation during analysis, discovery, impact, or planning stages.
- For markdown stages (01–05, 07–14): write AI-generated stage output only to the relevant `ai-output.md`.
- Do not write or overwrite `developer-review.md` or `final.md` unless explicitly allowed.
- Do not modify `.savyre/` telemetry files.

## Stage 06 Implementation (OVERRIDES Headless delivery below)

When Stage 06 — Implementation is active:

- Create/edit **application source files on disk** with file-write / apply-patch tools.
- Printing code or plans to chat/stdout is **not** enough and is a failure.
- Do **not** write `ai-output.md` for Stage 06.

## Headless / `codex exec` delivery

For **markdown stages** (not Stage 06):

- Prefer printing the **entire** stage markdown document as your final message (stdout becomes `ai-output.md`).
- Alternatively, write the complete document only to the stage `ai-output.md` path given in the prompt.
- Do **not** reply with a short status instead of the full document.
- For Stage 01, include `# Original Task`, `# Explicit Requirements`, and `## Open Questions`.

**Exception:** Stage 06 uses the Stage 06 Implementation rules above.

Use the Savyre extension panel for workflow stages and prompts. Work in `savyre/stages/`.
