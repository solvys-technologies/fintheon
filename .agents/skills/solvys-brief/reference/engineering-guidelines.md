# Solvys Engineering Guidelines

## Purpose

These guidelines distill the approved S47 engineering references into Solvys-native development practice. They do not authorize installing external skills or packages.

## Development Mindset

- Work in small vertical slices. A slice is done only when data, service, API, UI, validation, and changelog implications are understood.
- Prefer minimal correct changes over broad rewrites. Preserve recent changelog intent and unrelated worktree changes.
- Keep domain language precise. Use canonical feature names from `CLAUDE.md`; do not revive legacy names.
- Zoom out before changing architecture: identify the caller, boundary, data owner, failure modes, and validation path.

## Diagnosis Loop

Use this loop for bugs and regressions:

1. Reproduce the failure or identify why it cannot be reproduced locally.
2. Minimize to the smallest route, component, service, or data shape that still fails.
3. Form one hypothesis at a time.
4. Instrument or inspect evidence before editing.
5. Apply the smallest fix.
6. Regression-test the exact failure plus one adjacent edge case.

## Test And Feedback Loop

- For risky logic, write or identify the failing assertion first, then make it pass, then refactor.
- If no formal test harness exists, create a command-level proof: curl, build, typecheck, or browser-harness script.
- Static types, runtime Zod validation, and browser verification are complementary. Do not substitute one for all three when the change crosses boundaries.
- Every frontend build path must remove stale `dist` before build.

## Architecture Boundaries

- Separate I/O, validation, prompting, routing, and presentation.
- Use Zod at external boundaries and typed interfaces inside the boundary.
- Services must degrade when optional environment variables are missing. Required env vars must be documented.
- Tool-broker ideas from Executor are thinking-only: typed tool catalogs, explicit auth scopes, approval gates, audit logs, and resumable execution. Do not add Executor without TP approval.
- Context-agent ideas from non-vetoed stars are thinking-only: scope the context, summarize handoffs, and avoid dumping huge tool output into every agent.

## Review Gates

- File size stays under 300 lines or gets split by responsibility.
- No auth bypass, secret leak, unvalidated fetch target, unsanitized HTML, or destructive filesystem/DB operation without guardrails.
- New endpoints need request/response shape, auth stance, fallback behavior, and smoke test path.
- UI work needs responsive behavior, empty/loading/error states, and visual review against Solvys design guidelines.
- Changelog entry and substantial file headers are part of the definition of done.

## Veto Discipline

The following TP-vetoed sources must not influence S47 architecture, prompts, code, or review language:

- `Xquik-dev/x-twitter-scraper`
- `EveryInc/compound-engineering-plugin`
- `jamiepine/voicebox`
- `elder-plinius/CL4R1T4S`
- `Bitterbot-AI/bitterbot-desktop`
