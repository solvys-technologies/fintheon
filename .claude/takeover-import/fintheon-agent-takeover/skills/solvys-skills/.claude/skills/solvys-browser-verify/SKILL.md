---
name: solvys-browser-verify
description: Browser-facing verification and adversarial UI checks for Solvys apps. Use after UI changes, rendering fixes, mobile/PWA work, or when TP wants proof a surface works.
---

# Solvys Browser Verify

Verify real user paths and try to break them. Prefer Solvys browser-harness semantics: open, read, click, fill, screenshot, close.

## Checks

- Desktop and mobile viewport coverage.
- Happy path plus loading, empty, error, disabled, retry states.
- Adversarial path: rapid clicks, long text, missing data, auth boundary, stale network.
- Solvys UI rules: no gradients, emojis, sparkles, Kanban borders, generic shadows; use Solvys glass/flat-row surfaces appropriately.

## Output

```markdown
## Browser Verification
Surface: ...
Result: PASS | WARN | FAIL | BLOCKED

## Checks
- PASS ...

## Screenshots
- /tmp/...

## Fixes Needed
1. ...
```
