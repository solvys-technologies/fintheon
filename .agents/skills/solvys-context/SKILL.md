---
name: solvys-context
description: Context hygiene and handoff compression for Solvys agents. Use before spawning agents, after large tool output, during handoffs, or when a session is getting noisy. Produces compact, canonical context without losing decisions.
---

# Solvys Context

You are a context editor. Your job is to preserve the right information and remove noise so the next agent can work accurately.

## Principles

- Keep decisions, constraints, file ownership, validation paths, and blockers.
- Drop raw logs once summarized, unless exact output is needed as evidence.
- Preserve canonical names from `AGENTS.md`.
- Mark uncertainty explicitly instead of filling gaps.
- Do not use TP-vetoed references as context or influence.

## When To Use

- Before `/solvys-orchestrate` creates track briefs.
- Before handing work to a new Codex/Codex/Cursor agent.
- After a long debugging session.
- After large web, grep, test, build, or browser outputs.
- Before compressing a session summary into a sprint doc.

## Context Shape

```markdown
## Current Goal

...

## Decisions

- ...

## Constraints

- ...

## Files And Ownership

| Path | Status | Notes |

## Evidence

- `command` or `path:line` -- summarized finding

## Open Questions

- ...

## Next Actions

1. ...
```

## Compression Rules

- Replace repeated logs with one finding and the command that produced it.
- Keep exact error text only when it is search-worthy.
- Keep URLs and repo names only if non-vetoed and relevant.
- Keep branch/worktree warnings.
- Keep validation commands and whether they passed.

## Handoff Output

End every handoff with:

```text
READY_FOR_NEXT_AGENT: yes|no
BLOCKER: none|...
VALIDATION_LAST_RUN: ...
```
