# Sprint Brief: T6 — OpenClaw + Pulse Legacy Name Sweep

## Context

Live-code references to `OpenClaw` and `PulseComposer/PulseThread/etc` have already been renamed to Hermes and Fintheon respectively. What remains is pure comment/doc cleanup — stragglers in code comments, docstrings, and project docs. This is a low-complexity but broad-touch track. Start with a grep to enumerate, then apply renames verbatim.

## Branch Target

`s35-t6-legacy-name-sweep` (off `s34-unified`)

## Scope — Included

Pure comment/doc sweep for two legacy names:

1. **OpenClaw → Hermes.** Every comment, docstring, README, or MD file mentioning OpenClaw gets renamed. `useOpenClawChat`, `useOpenClawRuntime`, `OpenClaw*` — if any live symbol still exists, the rename includes TS identifiers. Expected live-symbol count: zero (verified via grep at kickoff).

2. **Pulse → Fintheon.** `PulseComposer`, `PulseThread`, `PulseFloatingChat`, `PulseAssistantMessage`, `PulseThinkingIndicator` — if any live symbols still exist, rename to Fintheon equivalents. Expected live-symbol count: zero. Comment/doc references get renamed.

Your FIRST step is to enumerate:

```bash
grep -rinE "OpenClaw|openclaw" --include="*.ts" --include="*.tsx" --include="*.md" frontend/ backend-hono/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog.ts | grep -v sprint-changelog | grep -v "sprint-briefs/ARCHIVE"

grep -rinE "\\bPulse(Composer|Thread|FloatingChat|AssistantMessage|ThinkingIndicator)\\b" --include="*.ts" --include="*.tsx" --include="*.md" frontend/ backend-hono/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog.ts | grep -v sprint-changelog | grep -v "sprint-briefs/ARCHIVE"
```

Every hit that is NOT a changelog entry, sprint archive, or historical record is yours to rename.

## Scope — Excluded (DO NOT TOUCH)

- `src/lib/changelog.ts` — historical record, do NOT rewrite
- `sprint-changelog/` — historical, DO NOT touch
- `docs/sprint-briefs/ARCHIVE.md` — historical
- Any file in `node_modules/`
- Any file owned by T1-T5, T7, T8
- `HARPER.md`, any `*.soul.md` files that describe an agent's internal narrative — OpenClaw/Pulse mentions there might be intentional history; skip unless TP confirms

## Reuse Inventory

- Rename pattern: `OpenClaw → Hermes`, `openclaw → hermes`, `OPENCLAW → HERMES`, preserving case. Use `sed -i '' 's/OpenClaw/Hermes/g'` cautiously — ONLY after grep identifies safe files.
- Same pattern for Pulse* → Fintheon*

## Known Issues to Preserve

- `feedback_fuses_are_sacred` memory: NEVER touch NothingFuse or fuse-adjacent code. If a Pulse\* reference is inside a fuse-related file, skip that hit.
- `feedback_fuses_are_sacred` also bans global icon-set swaps. This sweep is text-only; don't let any rename accidentally replace an icon import.
- Do NOT rename `PulseComposer` in historical comments that describe what USED to exist (e.g., "renamed from PulseComposer to FintheonComposer in v4.x"). Those are historical. Rename only FORWARD-LOOKING references.

## Implementation Steps

1. Run the two grep commands above; save the output to a scratch file or copy-paste into your chat
2. For each live-code hit, apply the appropriate rename with Edit tool (NOT sed — TP's memory rules prefer deliberate edits)
3. Re-run both grep commands; confirm zero live-code hits remain
4. Build-check: `npx tsc --noEmit --project frontend/tsconfig.json` + `cd backend-hono && bun run build`

## Acceptance Criteria

- [ ] Zero live-code references to `OpenClaw` (excluding changelog/sprint-changelog/ARCHIVE)
- [ ] Zero live-code references to `PulseComposer|PulseThread|PulseFloatingChat|PulseAssistantMessage|PulseThinkingIndicator`
- [ ] `tsc --noEmit` clean on frontend
- [ ] `bun run build` clean on backend-hono
- [ ] No accidental icon/import changes

## Validation Commands

```bash
# Pre-flight count
grep -rinE "OpenClaw|openclaw" --include="*.ts" --include="*.tsx" --include="*.md" frontend/ backend-hono/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog.ts | grep -v sprint-changelog | grep -v ARCHIVE | wc -l

grep -rinE "\\bPulse(Composer|Thread|FloatingChat|AssistantMessage|ThinkingIndicator)\\b" --include="*.ts" --include="*.tsx" --include="*.md" frontend/ backend-hono/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog.ts | grep -v sprint-changelog | grep -v ARCHIVE | wc -l

# After renames both should be 0
# Builds
npx tsc --noEmit --project frontend/tsconfig.json
cd backend-hono && bun run build
```

## Commit Format

```
[v5.25.0-S35-T6] chore: OpenClaw -> Hermes + Pulse -> Fintheon legacy comment sweep

Removes stale OpenClaw and Pulse* references from live-code comments
and docstrings. Live symbols were already renamed in prior sprints;
this closes out the doc drift. Changelog / sprint-changelog / ARCHIVE
left untouched (historical record).
```
