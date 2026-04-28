---
name: solvys-context
description: Context hygiene and handoff compression for Solvys agents. Use before spawning agents, after large tool output, during handoffs, or when a session is getting noisy.
---

# Solvys Context

Preserve decisions, constraints, file ownership, validation paths, blockers, and canonical names. Drop raw log noise once summarized.

## Output

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

READY_FOR_NEXT_AGENT: yes|no
BLOCKER: none|...
VALIDATION_LAST_RUN: ...
```
