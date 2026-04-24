# Sprint Brief: T11 — PMDB Chamber Read Integration

## Context

Arbitrum (S35-T1) runs a 5-seat Qwen deliberation at 17:00 ET weekdays and
persists the digest to `arbitrum_verdicts` with `trigger_type='session'`.
PMDB fires 15 minutes later (17:15 ET). This track is the last mile: teach
`brief-generator.ts` to pull the fresh session digest via T1's
`getLatestChamberRead()` helper and inject it as a "Chamber Read" section
into the PMDB prompt so the Post-Market Daily Brief leads with the
consensus + dissent the Chamber just produced.

Hard constraint from the plan: nothing should break. T1 lands the arbitrum
barrel on its own branch and T12 does the unification merge. T11's branch
therefore resolves the helper via a **runtime-constructed dynamic import
path** (`tsc` can't statically resolve it, so the build stays green before
T1 merges), and T12 swaps that for a direct import once the barrel exists
in `s35-unified`.

## Branch Target

`s35-t11-pmdb-chamber-read` (off `s34-unified`)

## Scope — Included

Single-file edit: `backend-hono/src/services/brief-generator.ts`

1. **Top-of-file comment** — add `[claude-code 2026-04-24] S35-T11: ...`
   header describing the injection and the dynamic-import rationale.
2. **New module-local helper `fetchChamberRead()`** — placed just before
   `getCurrentBriefType()`. Uses a runtime-constructed path
   (`const modulePath = "./arbitrum/index.js"; await import(modulePath)`)
   to dodge `tsc`'s static resolver, checks for
   `getLatestChamberRead` being a function, calls it, returns trimmed
   non-empty text or `null`. Wrapped in `try/catch`: any failure (module
   missing, helper missing, runtime error) logs a `warn` and returns
   `null` so brief generation never fails because Arbitrum is down.
3. **Fetch at the top of `generateBrief()`** — only for
   `briefType === "PMDB"`; ADB/MDB/WT skip the fetch entirely (zero cost
   on non-PMDB paths). Build a `chamberSection` string: a newline-framed
   `## Chamber Read (17:00 Arbitrum Session)\n<digest>\n` if present,
   empty string otherwise.
4. **Inject `${chamberSection}`** into the short-form prompt template
   (the `: \`...\``branch of the`isFull`ternary) between`${feedSummary}`and`## Instructions`.
5. **PMDB instruction tweak** — when `chamberRead` is truthy, swap the
   PMDB short-form instruction to: "Write 4-6 bullet points covering new
   developments since the afternoon brief — post-market moves, after-hours
   earnings, overnight catalysts. Lead with a 1-sentence restatement of the
   Chamber Read consensus above, flag any dissent, then the bullets. Be
   direct and actionable. Max 250 words." When `chamberRead` is null,
   the original instruction (3-5 bullets, 200 words) stays verbatim.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/boot/services.ts` — T12 owns all boot wiring
- `backend-hono/src/services/arbitrum/*` — T1 owns
- `supabase/migrations/*` — T2 owns the `arbitrum_verdicts` schema
- MDB / ADB / WT prompt branches — Chamber Read is PMDB-only
- `services/brief-generator.ts` regime-detection block (lines 189-239) —
  unrelated, leave intact
- Any other file — this track is a single-file edit

## Reuse Inventory

- **T1 export contract** (`backend-hono/src/services/arbitrum/verdict-store.ts`,
  surfaced via barrel `services/arbitrum/index.ts`):
  `getLatestChamberRead(): Promise<string | null>` — returns latest
  `trigger_type='session'` verdict's `digest_text` or `null`
- **PMDB detection** — `getCurrentBriefType()` at
  `brief-generator.ts:33-46`; PMDB window is 17:30-06:30 ET (confirms
  17:00 Arbitrum precedes 17:15 PMDB)
- **Existing short-form prompt template** at `brief-generator.ts:161-174`
  (the `: \`...\`` branch of the isFull ternary) — the insertion surface

## Known Issues to Preserve

- The dynamic import path MUST be a runtime-constructed variable
  (`const modulePath = "./arbitrum/index.js"; await import(modulePath)`).
  Writing the literal string inside `import()` directly will make `tsc`
  try to resolve it and fail before T1 lands.
- `getLatestChamberRead()` can legitimately return `null` on a day the
  chamber didn't fire (market holiday, scheduler crashed, etc.). PMDB
  must gracefully fall back to its original short-form template — no
  empty "## Chamber Read" heading, no error surfaced to the user.
- PMDB is the ONLY brief type that gets the Chamber Read injection.
  ADB runs at 11:00+ and predates the 17:00 chamber session. MDB runs
  6:30 AM next day (too stale). WT is its own report.
- The T1 helper's return value is already a string of the model-produced
  digest — do NOT re-wrap, re-format, or truncate it. Inject as-is.

## Implementation Steps

1. Add `[claude-code 2026-04-24] S35-T11: ...` comment at the top of
   `backend-hono/src/services/brief-generator.ts`.
2. Add `fetchChamberRead()` helper between `BRIEF_LABELS` and
   `getCurrentBriefType()`. Use the runtime-string dynamic-import pattern.
3. Inside `generateBrief()`, after the `econSummary` block and before
   the `isFull` constant, add:
   ```ts
   const chamberRead = briefType === "PMDB" ? await fetchChamberRead() : null;
   const chamberSection = chamberRead
     ? `\n## Chamber Read (17:00 Arbitrum Session)\n${chamberRead}\n`
     : "";
   ```
4. In the short-form prompt template (else branch of `isFull` ternary),
   add `${chamberSection}` between `${feedSummary}` and `## Instructions`.
5. In the same template's instructions block, wrap the PMDB branch in
   a second ternary on `chamberRead` — truthy path gets the 4-6 bullet
   "lead with consensus" instruction, falsy path keeps the original
   3-5 bullet instruction verbatim.
6. Add a changelog entry to `src/lib/changelog.ts` describing the track.

## Acceptance Criteria

- [ ] `backend-hono/src/services/brief-generator.ts` contains
      `fetchChamberRead` helper with runtime-constructed import path
- [ ] PMDB prompt template contains the `${chamberSection}` injection slot
- [ ] PMDB instruction tweak fires only when `chamberRead` is non-null
- [ ] `cd backend-hono && bun run build` clean (green before T1 lands)
- [ ] `cd backend-hono && npx tsc --noEmit` clean
- [ ] `generateBrief("PMDB")` unit-smoke: no throw when arbitrum module
      missing; warns and falls back to original short-form prompt
- [ ] `src/lib/changelog.ts` has S35-T11 entry

## Validation Commands

```bash
# Confirm the edits landed
grep -n "S35-T11" backend-hono/src/services/brief-generator.ts
grep -n "fetchChamberRead" backend-hono/src/services/brief-generator.ts
grep -n "Chamber Read (17:00 Arbitrum Session)" backend-hono/src/services/brief-generator.ts

# Build stays green before T1 merges
cd backend-hono && bun run build

# Post-T12 unification (reference — not on T11 branch):
#   Direct-import replaces the runtime-string pattern
#   grep should find: `import { getLatestChamberRead } from "./arbitrum/index.js";`
```

## T12 Handoff Notes

- T12 unification: swap the runtime-string dynamic import for a direct
  top-of-file import once `services/arbitrum/index.ts` exists in
  `s35-unified`. Drop the try/catch wrapper's module-missing branch
  (keep the helper-returned-null graceful path).
- Browser Harness validation in T12 should trigger a manual PMDB
  generation after the first 17:00 cron fire and confirm the "Chamber
  Read" section renders in the generated brief.
- Empty-state acceptable on first deploy — the chamber hasn't fired yet
  the first day, so PMDB falls back to the original template until the
  17:00 ET cron produces the first row in `arbitrum_verdicts`.
