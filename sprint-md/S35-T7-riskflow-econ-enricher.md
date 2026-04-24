# Sprint Brief: T7 — RiskFlow Econ Enricher Rename

## Context

The `EconEnricher` cron service writes Notion economic-calendar prints into the RiskFlow feed. Its name doesn't tie it to the RiskFlow feature it's part of. Rename to `RiskFlowEconEnricher` — file, class/logger, exported functions, imports, internal comments. `backend-hono/src/boot/services.ts` imports the current `startEconEnricher` — the import update is deferred to T12 unification (which also edits this file for T1 arbitrum scheduler + T5 TOTT comment).

## Branch Target

`s35-t7-riskflow-econ-enricher` (off `s34-unified`)

## Scope — Included

- [ ] RENAME file: `backend-hono/src/services/cron/econ-enricher.ts` → `backend-hono/src/services/cron/riskflow-econ-enricher.ts`
- [ ] Inside the renamed file:
  - `createLogger("EconEnricher")` → `createLogger("RiskFlowEconEnricher")`
  - All `[EconEnricher]` log-prefix strings → `[RiskFlowEconEnricher]`
  - `export function startEconEnricher()` → `export function startRiskFlowEconEnricher()`
  - `export function stopEconEnricher()` → `export function stopRiskFlowEconEnricher()`
  - Top-of-file comment `// [claude-code 2026-03-14] Econ enricher — writes Notion calendar prints to RiskFlow feed (FMP removed)` → `// [claude-code 2026-04-24] RiskFlow Econ Enricher — writes Notion calendar prints to RiskFlow feed (renamed from econ-enricher in S35)`
- [ ] EDIT `backend-hono/src/services/cron/market-impact-enricher.ts` line 121 — comment `// ─── Scheduler (setInterval-based, same pattern as econ-enricher) ───` → `// ─── Scheduler (setInterval-based, same pattern as riskflow-econ-enricher) ───`
- [ ] EDIT `backend-hono/src/services/cron/boardroom-scheduler.ts` line 6 — comment `* Follows the same start/stop pattern as autopilot-scheduler.ts and econ-enricher.ts.` → `* Follows the same start/stop pattern as autopilot-scheduler.ts and riskflow-econ-enricher.ts.`
- [ ] EDIT `backend-hono/src/services/riskflow/econ-bridge.ts` line 17 — comment `* Called by econ-enricher and econ-triggered-poller when an actual lands.` → `* Called by riskflow-econ-enricher and econ-triggered-poller when an actual lands.`

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/boot/services.ts` — T12 unification handles the import-rename from `startEconEnricher` to `startRiskFlowEconEnricher` + the boot-log message update. This file is excluded from this track.
- `econ-bridge.ts` OTHER than the line-17 comment
- `market-impact-enricher.ts` OTHER than the line-121 comment
- `econ-triggered-poller.ts` (sibling service) — name alignment for that file is out of scope for S35; defer to a future sprint
- `backend-hono/dist/**` — compiled; regenerated on next build

## Reuse Inventory

- Existing file rename pattern: use `git mv` (NOT delete + create) so git history follows the file
- Logger naming convention: PascalCase inside `createLogger("Name")` — mirror existing services (e.g., `createLogger("BriefGenerator")`)
- Existing tsc import resolution — after `git mv`, imports across the codebase might auto-resolve to `.js` extension (backend-hono uses `.js` imports inside `.ts` files per ESM). Verify none break.

## Known Issues to Preserve

- The file is referenced in `boot/services.ts` by its import path; T12 owns that edit — do NOT touch `boot/services.ts` in this track.
- `dist/` compiled files will be stale until next build; do NOT edit `dist/` directly.
- No DB schema changes here. No env var changes. No cron-ID string changes (the old ID didn't include "econ-enricher" as a magic string; confirm via grep).

## Implementation Steps

1. `git mv backend-hono/src/services/cron/econ-enricher.ts backend-hono/src/services/cron/riskflow-econ-enricher.ts`
2. Open the renamed file and apply the symbol renames listed above:
   - `createLogger("EconEnricher")` → `createLogger("RiskFlowEconEnricher")` (single occurrence around line 11)
   - `[EconEnricher]` in log strings → `[RiskFlowEconEnricher]` (occurrences around lines 60, 66)
   - `startEconEnricher` → `startRiskFlowEconEnricher` (function definition + any internal reference)
   - `stopEconEnricher` → `stopRiskFlowEconEnricher`
   - Top-of-file comment update
3. Edit the 3 cross-reference comment lines in `market-impact-enricher.ts`, `boardroom-scheduler.ts`, `econ-bridge.ts`
4. Run `cd backend-hono && bun run build` — type errors are EXPECTED because `boot/services.ts` still imports the old symbol names. Note the errors but DO NOT fix boot/services.ts — T12 handles that. The type error is the expected signal that T12 needs to run.
5. Add a note to the commit message: "Build breaks in boot/services.ts until T12 lands; T12 renames the import."

## Acceptance Criteria

- [ ] File renamed via `git mv` (history preserved)
- [ ] All symbol renames applied inside the file
- [ ] 3 cross-reference comments updated
- [ ] `boot/services.ts` UNTOUCHED (T12's responsibility)
- [ ] Branch builds cleanly IF you manually stub boot/services.ts; OR acknowledge the expected break in the commit message
- [ ] No DB changes, no env var changes

## Validation Commands

```bash
# Verify file renamed, not copied
git log --follow backend-hono/src/services/cron/riskflow-econ-enricher.ts | head -20

# Verify symbols inside
grep -n "RiskFlowEconEnricher\\|riskflow-econ-enricher" backend-hono/src/services/cron/riskflow-econ-enricher.ts

# Verify cross-refs
grep -n "riskflow-econ-enricher" backend-hono/src/services/cron/market-impact-enricher.ts backend-hono/src/services/cron/boardroom-scheduler.ts backend-hono/src/services/riskflow/econ-bridge.ts

# Confirm boot/services.ts unchanged
git diff s34-unified -- backend-hono/src/boot/services.ts | head -3
# (should be empty)

# Build will break on boot/services.ts import until T12 — this is expected
cd backend-hono && bun run build 2>&1 | head -20
```

## Commit Format

```
[v5.25.0-S35-T7] refactor: EconEnricher -> RiskFlowEconEnricher

Renames cron/econ-enricher.ts -> cron/riskflow-econ-enricher.ts via
git mv. Updates logger name, start/stop exports, log prefix, and
cross-reference comments in market-impact-enricher.ts,
boardroom-scheduler.ts, riskflow/econ-bridge.ts.

boot/services.ts import update deferred to T12 unification (same file
T1 + T5 also edit; T12 handles all three atomically).
```
