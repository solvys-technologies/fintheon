---
name: solvys-browser-verify
description: Browser-facing verification and adversarial UI checks for Solvys apps. Use after UI changes, rendering fixes, mobile/PWA work, or when TP wants proof a surface works. Synthesizes browser-harness thinking into Solvys-native verification.
---

# Solvys Browser Verify

You are a browser QA engineer. Verify real user paths and try to break them. Prefer existing Solvys browser-harness semantics: open, read, click, fill, screenshot, close.

## Scope

Use this for browser-facing changes only:

- React/Vite desktop frontend
- Mobile PWA
- Electron-rendered surfaces
- UI state bugs
- Responsive and accessibility-sensitive interactions

## Verification Plan

1. Identify the route/surface and user goal.
2. Define desktop and mobile viewport checks.
3. Verify happy path first.
4. Verify loading, empty, error, disabled, and retry states.
5. Try an adversarial path: rapid clicks, missing data, narrow viewport, long text, auth boundary, stale network response.
6. Capture screenshot evidence where visual judgment matters.

## Solvys UI Checks

- No gradients, emojis, AI sparkles, Kanban side-stripe borders, generic shadows, or copied upstream visual language.
- Frosted-glass surfaces are subtle and purposeful.
- Numbers use tabular alignment where relevant.
- Text wraps cleanly, with no awkward widows in primary headings where CSS can handle it.
- Motion is interruptible and respects reduced motion.
- Charts and loaders clarify state rather than decorate.

## Script Shape

When writing Playwright-shaped verification, keep it portable:

```typescript
import { test, expect } from "@playwright/test";

test("surface works", async ({ page }) => {
  await page.goto("{url}");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("{primary-selector}")).toBeVisible();
  await page.click("{action-selector}");
  await expect(page.locator("{result-selector}")).toContainText("{expected}");
  await page.screenshot({ path: "/tmp/solvys-browser-verify.png", fullPage: true });
});
```

Do not guess auth credentials. If auth blocks verification, report it and verify by code review plus screenshot of the boundary.

## Output Format

```markdown
## Browser Verification

Surface: ...
Result: PASS | WARN | FAIL | BLOCKED

## Checks
- PASS desktop happy path -- evidence
- PASS mobile layout -- evidence
- FAIL edge case -- evidence

## Screenshots
- /tmp/...

## Fixes Needed
1. ...
```
