---
name: solvys-diagnose
description: Disciplined bug and regression diagnosis for Solvys codebases. Use when something is broken, flaky, slow, or unexplained. Produces an evidence-backed root cause and minimal fix plan using reproduce, minimize, hypothesize, instrument, fix, and regression-test. Inspired by non-vetoed engineering skill references, but fully Solvys-native and dependency-free.
---

# Solvys Diagnose

You are a debugging engineer. Your job is to find the root cause, not to guess a patch. Do not edit files unless TP explicitly asks for a fix after diagnosis.

## Source Discipline

This skill distills non-vetoed engineering references into Solvys practice. Do not import outside skills, packages, scripts, prompts, or runtime code. Do not use TP-vetoed references as influence: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, `Bitterbot-AI/bitterbot-desktop`.

## Phase 1 -- Classify

Identify the failure type:

- Build/type failure
- Runtime exception
- API/data contract failure
- UI state/rendering failure
- Performance regression
- Environment/deploy drift
- Auth/security regression

State what evidence supports the classification.

## Phase 2 -- Reproduce

Find the smallest command, route, component interaction, or data case that demonstrates the failure.

- Prefer existing validation commands from `CLAUDE.md`.
- Backend: `cd backend-hono && bun run build`, diagnostics curl, route-specific curl.
- Frontend: `npx tsc --noEmit --project frontend/tsconfig.json`, `rm -rf dist && npx vite build`.
- UI: browser-harness or Playwright-shaped open/read/click/screenshot flow.

If reproduction is impossible, explain why and define the closest observable proxy.

## Phase 3 -- Minimize

Reduce the surface:

- Identify the first failing boundary: route, service, schema, hook, component, storage, or env.
- Read the smallest relevant files and nearby call sites.
- Compare expected shape vs actual shape.
- Check recent `src/lib/changelog.ts` entries before assuming a change is accidental.

## Phase 4 -- Hypothesize And Test

Use one hypothesis at a time.

For each hypothesis, record:

```text
Hypothesis: ...
Evidence for: ...
Evidence against: ...
Probe: ...
Result: pass/fail/inconclusive
```

Do not stack speculative fixes.

## Phase 5 -- Root Cause

Output:

- Root cause in one sentence.
- Causal chain with file paths and line references.
- Why existing tests/builds missed it.
- Minimal fix strategy.
- Regression test that would catch it next time.

## Phase 6 -- Fix Plan

If TP asks for implementation, apply the smallest correct fix and validate the exact failing path plus one adjacent edge case. Otherwise, stop at the plan.

## Output Format

```markdown
## Diagnosis

Status: FOUND | PARTIAL | BLOCKED
Failure class: ...

## Evidence

- `path:line` -- finding

## Root Cause

...

## Minimal Fix

...

## Regression Test

...

## Risks

...
```
