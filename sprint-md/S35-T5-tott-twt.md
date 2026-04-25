# Sprint Brief: T5 — TOTT → TWT Rename

## AMENDMENT 2026-04-24 — SCOPE EXPANSION (read first)

**The codebase currently runs three flavors: TOTT (docstrings/prompts), WT (type unions + runtime checks), TWT (TP's locked canonical).** Scope expands accordingly:

1. **WT → TWT in runtime code:**
   - `backend-hono/src/services/supabase-service.ts:691` — `BriefType = "MDB" | "ADB" | "PMDB" | "WT"` → `"MDB" | "ADB" | "PMDB" | "TWT"`
   - `backend-hono/src/services/brief-generator.ts:101` — `briefType === "WT"` → `briefType === "TWT"` (any other line with `=== "WT"` too)
   - `backend-hono/src/routes/data/index.ts:185` — `["MDB", "ADB", "PMDB", "WT"]` → `["MDB", "ADB", "PMDB", "TWT"]`
   - Any `briefType: "WT"` literal in `services/cron/dispatch-scheduler.ts` (if the 4:30 PM Sunday entry uses WT, rename to TWT)

2. **Legacy alias for 2 weeks (sunset 2026-05-08):** at every input point (`POST /api/data/brief/generate`, `dispatch-brief.ts` script, any other accepting a `type` parameter), normalize incoming `"WT"` or `"TOTT"` → `"TWT"` BEFORE any runtime check. Log the normalization once per invocation: `log.info({received, normalizedTo: "TWT"}, "legacy brief type alias normalized")`. No caller that sends WT or TOTT today breaks.

3. **DB rows already stored as `"WT"`**: no migration required — the normalization handles reads too. After 2026-05-08, follow-up sprint can `UPDATE briefs SET type = 'TWT' WHERE type IN ('WT', 'TOTT')`.

The original TOTT→TWT file list below is unchanged — just add the three runtime-code files above to it.

## Context

The weekly tribune brief is currently called TOTT ("Tip of the Tape" or "Tale of the Tape" — both appear). TP locked in **TWT** ("The Weekly Tribune") as the canonical name. Rename every live reference. 8 files to edit plus one cron job ID rename. `backend-hono/src/boot/services.ts` has a comment mentioning TOTT on line ~276 — leave that to T12 unification (same file T1/T7 also need unification to edit).

## Branch Target

`s35-t5-tott-twt` (off `s34-unified`)

## Scope — Included

- [ ] `backend-hono/scripts/dispatch-brief.ts` — type literal `"TOTT"` in union type, `TOTT` key in prompt map, prompt body `(TOTT - Tip of the Tape)`, category assignment (`BRIEF_TYPE === "TOTT" ? "weekly"`). Rename all to `"TWT"` / `"TWT"` / `(TWT - The Weekly Tribune)` / `BRIEF_TYPE === "TWT"`
- [ ] `backend-hono/src/services/cron/dispatch-scheduler.ts` — cron job ID `com.fintheon.dispatch-tott` → `com.fintheon.dispatch-twt`; schedule comment `4:30 PM Sunday — TOTT (Tale of the Tape / Weekly Tribune)` → `4:30 PM Sunday — TWT (The Weekly Tribune)`
- [ ] `backend-hono/src/services/harper-handler.ts` — line 110 (`**TOTT** = Tip of the Tape / Weekly Tribune`) + line 111 (union `{ type: "MDB"|"ADB"|"PMDB"|"TOTT" }`) + line 128 (`com.fintheon.dispatch-tott — 4:30 PM ET Sundays`). Rename label to `**TWT** = The Weekly Tribune`, union to include `"TWT"`, cron id to `com.fintheon.dispatch-twt`
- [ ] `backend-hono/src/services/harper-autonomous/HARPER-SOUL.md` — line 115 brief union includes `"TOTT"`, line 129 cron id, line 230 trigger `After any MDB/ADB/PMDB/TOTT brief`. Rename all three.
- [ ] `backend-hono/src/services/ai/agent-instructions/harper-extra.md` — line 22 `com.fintheon.dispatch-tott` → `com.fintheon.dispatch-twt`
- [ ] `backend-hono/src/services/knowledge-graph/llm.ts` — line 28 `new brief section (added to MDB/ADB/PMDB/TOTT)` → `new brief section (added to MDB/ADB/PMDB/TWT)`
- [ ] `backend-hono/src/routes/data/index.ts` — line 178 comment `// GET /api/data/brief?type=MDB|ADB|PMDB|TOTT` → `// GET /api/data/brief?type=MDB|ADB|PMDB|TWT`
- [ ] `frontend/components/executive/MainDashboard.tsx` — line 127-134 comments: `// Brief type windows: TOTT (Sun>=17:00 through Mon<7AM)...` and `// TOTT: Sunday >= 17:00 through Monday < 07:00`. Rename TOTT → TWT. ALSO: if there's a runtime check on the string `"TOTT"` (e.g., `type === "TOTT"`), rename that too.

Backend brief dispatch accepts either "TOTT" or "TWT" for a 2-week migration window: keep a legacy mapping in `dispatch-brief.ts` and `routes/data/index.ts` that forwards `"TOTT"` to `"TWT"` internally, with a comment `// S35-T5: legacy TOTT alias sunsets 2026-05-08`. This prevents any stale scheduled Routine or external call from 500ing.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/boot/services.ts` line 276 (`Dispatch scheduler (cron-driven MDB/ADB/PMDB/TOTT briefing generation)`) — T12 unification edits this file (also needs T1's arbitrum scheduler wire and T7's econ-enricher import). Leave it.
- Any TOTT reference inside `dist/` — compiled artifacts; they regenerate on next build.
- Historical references in `src/lib/changelog.ts`, `docs/sprint-briefs/ARCHIVE.md`, `sprint-changelog/` — do NOT rewrite history.
- Any TOTT in comments that are quoting OLD sprint briefs or decisions — those stay as historical record.
- Files touched by T4, T6, T7, T8 — off-limits.

## Reuse Inventory

- Existing MDB/ADB/PMDB string-matching pattern in `dispatch-brief.ts` — mirror for TWT
- Existing cron ID pattern `com.fintheon.dispatch-*` in `dispatch-scheduler.ts` — rename the TOTT entry to TWT, preserve the other three
- Backward-compatibility alias pattern — if the codebase has any similar alias elsewhere, mirror that; otherwise the pattern is: check incoming value, map `"TOTT"` → `"TWT"` early, then proceed with `"TWT"` through the rest of the flow

## Known Issues to Preserve

- `com.fintheon.dispatch-*` IDs are conceptual cron job identifiers used by Fintheon's in-process node-cron registry — they're strings, not actual launchd plist IDs. Rename the string; no plist/launchd change needed. (Memory: `feedback_no_claude_routines` — Fintheon retired Anthropic Routines; this is in-process cron only.)
- Frontend MainDashboard.tsx time windows (Sun ≥ 17:00 → Mon < 7AM) — preserve the timing logic; only rename the label.
- Brief type stored in DB column — if `ai_brief` / `briefs` / `daily_briefs` tables persist the type as a string "TOTT", the 2-week dual-write window prevents breakage. After sunset, a follow-up migration can `UPDATE briefs SET type = 'TWT' WHERE type = 'TOTT'`.

## Implementation Steps

1. Grep for every `TOTT` occurrence: `grep -rnE "TOTT|tott" backend-hono/src/ frontend/ mobile/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v changelog | grep -v sprint-changelog | grep -v ARCHIVE`
2. For each hit in the Scope list above, apply the rename exactly as specified
3. Add the legacy alias handler in `dispatch-brief.ts` and `routes/data/index.ts`: accept "TOTT" as input, map to "TWT" internally, log once per invocation
4. Run `cd backend-hono && bun run build` — fix any type errors from the union rename (likely needs updates in a few call sites)
5. Run `npx tsc --noEmit --project frontend/tsconfig.json` — fix MainDashboard type issues
6. Verify no live-code TOTT references remain: `grep -rnE "\\bTOTT\\b" backend-hono/src/ frontend/ mobile/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v changelog | grep -v sprint-changelog | grep -v ARCHIVE` should return zero

## Acceptance Criteria

- [ ] All 8 files edited with TOTT → TWT per the list
- [ ] Cron ID `com.fintheon.dispatch-twt` (not tott)
- [ ] `POST /api/data/brief/generate` with `{type: "TWT"}` succeeds
- [ ] `POST /api/data/brief/generate` with `{type: "TOTT"}` STILL succeeds (legacy alias; logs a deprecation warning once)
- [ ] `bun run build` clean
- [ ] `tsc --noEmit` clean on frontend
- [ ] No live-code TOTT refs outside of historical files

## Validation Commands

```bash
# Verify rename coverage
grep -rnE "\\bTOTT\\b" backend-hono/src/ frontend/ mobile/ --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | grep -v changelog | grep -v sprint-changelog | grep -v ARCHIVE

# Verify TWT landed
grep -rn "TWT" backend-hono/src/services/ backend-hono/scripts/ frontend/ | head -20

# Builds
cd backend-hono && bun run build
cd .. && npx tsc --noEmit --project frontend/tsconfig.json

# Smoke the legacy alias
curl -X POST http://localhost:8080/api/data/brief/generate -H "Content-Type: application/json" -d '{"type":"TWT"}' | head -c 200
curl -X POST http://localhost:8080/api/data/brief/generate -H "Content-Type: application/json" -d '{"type":"TOTT"}' | head -c 200
```

## Commit Format

```
[v5.25.0-S35-T5] feat: TOTT -> TWT rename (The Weekly Tribune)

Renames brief type across dispatch-brief, dispatch-scheduler (cron id
com.fintheon.dispatch-twt), harper-handler prompts, HARPER-SOUL.md,
harper-extra.md, knowledge-graph/llm.ts, routes/data comment, and
MainDashboard time-window comments. Adds legacy TOTT -> TWT alias in
brief dispatch (sunsets 2026-05-08) to prevent stale-caller breakage.
boot/services.ts comment left to T12 unification.
```
