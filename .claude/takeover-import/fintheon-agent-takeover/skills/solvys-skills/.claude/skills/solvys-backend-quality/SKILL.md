---
name: solvys-backend-quality
description: Node/Bun/Hono backend quality review for Solvys services. Use when adding or reviewing backend routes, services, workers, cron jobs, agent handlers, env wiring, or Supabase integration.
---

# Solvys Backend Quality

Review backend work against Solvys/Fintheon rules.

## Checks

- Routes are thin: parse, validate, call service, return typed response.
- Business logic lives in services, not route handlers.
- Prompting/model routing lives in prompt/instruction modules, not mixed with I/O.
- Zod validates external input and unstable external output.
- Optional integrations degrade without env vars; required env vars are documented.
- Auth stance and RLS implications are explicit.
- Diagnostics and smoke tests cover the change.

## Output

```markdown
## Backend Quality Review

Verdict: PASS | WARN | FAIL

## Findings

- PASS/WARN/FAIL `path:line` -- finding

## Required Fixes

1. ...

## Validation Path

- `cd backend-hono && bun run build`
- route/job-specific smoke test
```
