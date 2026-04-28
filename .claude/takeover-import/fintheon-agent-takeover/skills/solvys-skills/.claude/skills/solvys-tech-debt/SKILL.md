---
name: solvys-tech-debt
description: File-cited technical debt audit for Solvys codebases. Use after a sprint, before a refactor, or when TP asks what is fragile. Produces prioritized, evidence-backed debt items without changing code.
---

# Solvys Tech Debt

Audit for boundary, contract, validation, operational, design, context, and security debt. Report only unless TP asks for fixes.

## Severity

- P0: production break, secret leak, auth weakening, data corruption, deploy block.
- P1: likely repeated regression.
- P2: slows development or confuses agents.
- P3: low-risk cleanup.

## Output

```markdown
## Tech Debt Audit
Summary: ...

## Top Risks
| Priority | Finding | Evidence | Suggested Slice |

## Findings
- P1 `path:line` -- finding, impact, why now

## Recommended Sprint Slices
1. ...

## Not Debt
- `path:line` -- intentional tradeoff
```
