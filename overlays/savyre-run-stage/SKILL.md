---
name: savyre-run-stage
description: Bootstrap the active Savyre execution. Use when a Savyre stage is enforced and the user wants the current stage run, resumed, or submitted. Pick the matching role skill. Do not invent Savyre methodology.
---

# Run the active Savyre stage

You are a generic runner. You do not own Savyre's stage method, scoring, or acceptance.

Stage textbooks live in the **Savyre extension** `prompts/stages/`, not in this plugin. Role skills here are short instructions only.

Works the same in **Claude Code** and Cursor - JSON `userMessage` / `cursorSkill` / `turn.activeSkill` come from the shared guard via `savyre-cli.mjs`.

## Before you start

1. Run `/savyre-status` (or `savyre-cli.mjs status`) in this workspace.
2. If `mode` is `idle`, tell the user to start the lock first (extension Run button or `/savyre-start`). Do not work the stage anyway.
3. If `mode` is `enforced`, continue with the skill in JSON `cursorSkill` (from `turn.activeSkill`):

### Fifteen-stage / legacy role map
- `savyre.task-input-dialogue` → `savyre-task-input`
- `savyre.requirement-analysis` → `savyre-requirement-analyst`
- `savyre.requirement-challenge` → `savyre-requirement-challenge`
- `savyre.codebase-discovery` → `savyre-codebase-discovery`
- `savyre.evidence-grounding` → `savyre-evidence-grounding`
- `savyre.verification-before-completion` → `savyre-verification-before-completion`
- `04-impact-analysis` → `savyre-impact-analyst`
- `05-plan-generation-and-review` → `savyre-plan-generation-and-review`
- `06-implementation` / `s04-build-review` → `savyre-implementation`

### Seven-stage role map (bundle_candidate_1)
- `s01` / task definition → `savyre-stage-task-definition`
- `s02` / code discovery → `savyre-stage-code-discovery`
- `s03` / implementation plan → `savyre-stage-implementation-plan`
- `s04` / build & review → `savyre-stage-build-review` (also honor `savyre-implementation` + `nextBacklogItemId`)
- `s05` / test & resolve → `savyre-stage-test-resolve`
- `s06` / delivery readiness → `savyre-stage-delivery-readiness`
- `s07` / handoff → `savyre-stage-handoff`

### Shared capability skills (every stage)
JSON `capabilitySkills` (`savyre.response-composer`, `savyre.unified-chat-turn`, `savyre.intervention-judge`, `savyre.chat-continuation`, `savyre.failure-recovery`) ride along every stage. Do **not** switch `activeSkill` to them.

Any other stage → stay generic; do not invent that stage's method.

## While enforced

- Fetch **current-stage instructions** from Savyre MCP when it exists. If MCP is not connected, say so and wait.
- Follow the active permission slip. Markdown stages may write that stage's `ai-output.md` plus Stage 02 `challenge-findings.json` or Stage 03 `evidence-map.json`. Do not edit application source on analysis/planning stages, run shell (except the plugin lifecycle CLI), or approve the stage.
- On Build & Review / Implementation: honor `nextBacklogItemId` — one backlog item per turn. Do not invent lock while backlog remains.
- Submit structured output only as Savyre instructs. Chat cannot record `ACCEPTED` or enable the next stage.

## When the user is done

Speak `userMessage` and wait for the slash it names. Continue steps are `/savyre-next`. **Talk first, then speak JSON `userMessage` as the last line.** Do not paste JSON. `/savyre-stop` only clears the lock.
