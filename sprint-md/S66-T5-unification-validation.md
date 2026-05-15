# Sprint Brief: T5 — Unification & Validation

## Context

All four feature tracks (T1 instrument/desk-plan, T2 lockout/lock-screen, T3 toolbar/drag-drop, T4 chat/rich-text) have written to the shared `sprint/S66` branch. This track merges their changes, resolves interface mismatches, runs the full validation suite, and produces the final changelog entry.

## Branch Target

`sprint/S66`

## Scope — Included

### Conflict Resolution
- [ ] `frontend/contexts/SettingsContext.tsx` — T1 added `selectedInstrument` field. T2 added `lockoutPermission` field. Verify both additions are present and neither deleted existing fields. Merge any import/layout conflicts.
- [ ] `frontend/components/narrative/DayCard.tsx` — T1 added multi-week cycling, pricing logic, "Trading Window" label, and imported `useLockout()` for the lock button. T3 added `desk-plan-lock-btn` CSS class and shimmer animation styles. Verify: (a) T1's lock button has class `desk-plan-lock-btn`, (b) T3's CSS animation targets this class, (c) both work together — clicking lock triggers shimmer.
- [ ] `frontend/components/layout/TopHeader.tsx` — T2 added/consolidated lock button (lines 584-644). T3 reworked the entire toolbar layout with @dnd-kit. Verify: (a) T2's new "Lock til Desk Session" button exists and works, (b) T3's @dnd-kit sortable context wraps all toolbar items, (c) lock button is draggable like other items, (d) no duplicate lock button instances.
- [ ] `frontend/package.json` — T3 added @dnd-kit dependencies. Verify package.json has `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Run `npm install` or `bun install` if needed.
- [ ] Any other cross-track file modifications not caught above — run `git diff --name-only` to identify all changed files, then manually review for conflicts.

### Integration Testing
- [ ] `src/lib/changelog.ts` — Add the final S66 entry:
  ```typescript
  { date: '2026-05-14T...', agent: 'claude-code', summary: 'S66 Release Suite: instrument expansion + per-instrument IV scoring globally, multi-week Desk Plan with TWT, pre-session pricing 30min before via TV RSS, permanent macOS lockout permissions + themed lock screen, customizable drag-and-drop toolbar with pill bar icon swapping, chat overhaul with collapsible iOS-style tool call cards and Nothing-style braille spinners, and global rich text rendering.', files: ['...list all changed files...'] }
  ```
- Verify no S65 changelog entries were modified.
- Run both frontend builds with staleness prevention: `rm -rf dist` before each `vite build`.

### Full Validation Suite
- [ ] **Frontend type check**: `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] **Frontend build**: `rm -rf dist && npx vite build`
- [ ] **Mobile type check**: `cd mobile && npx tsc --noEmit`
- [ ] **Mobile build**: `cd mobile && rm -rf dist && npx vite build`
- [ ] **Backend build**: `cd backend-hono && bun run build`
- [ ] **Backend restart**: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
- [ ] **Diagnostics curl**: `curl -s http://localhost:8080/api/diagnostics`
- [ ] **Lockout status curl**: `curl -s http://localhost:8080/api/lockout/status`
- [ ] **Day plan today curl**: `curl -s http://localhost:8080/api/day-plan/today`
- [ ] **Multi-week curl**: `curl -s "http://localhost:8080/api/day-plan/multi-week?from=$(date +%Y-%m-%d)&to=$(date -v+4w +%Y-%m-%d)"`
- [ ] **IV score curl**: `curl -s "http://localhost:8080/api/market-data/iv-score?symbol=%2FNQ"` (verify instrument field present)
- [ ] **Arbitrum latest curl**: `curl -s "http://localhost:8080/api/arbitrum/latest?instrument=%2FNQ"`
- [ ] **RiskFlow feed curl**: `curl -s "http://localhost:8080/api/riskflow/feed?limit=5"`
- [ ] **Playwright Browser Harness**: Verify heading toolbar renders with all items, Desk Plan DayCard shows multi-week cycling, chat interface shows collapsible tool call cards with thinking phrases and braille spinners, lock screen overlay exists and shows themed background.

### Final Changelog Protocol
After all validation passes:
1. Add changelog entry to `src/lib/changelog.ts`
2. Add header comment to each substantially modified file: `// [claude-code 2026-05-14] S66: ...`

## Scope — Excluded (DO NOT TOUCH)

- No new features — T5 is integration only
- No refactoring unless resolving a cross-track conflict

## Implementation Steps

1. Pull latest sprint/S66. Run `git log --oneline -20` to see all commits.
2. Run `git diff --name-only HEAD~10` or review all changed files.
3. Check the three known conflict files first: SettingsContext.tsx, DayCard.tsx, TopHeader.tsx.
4. Run `npm install` or `bun install` in frontend/ to ensure @dnd-kit is installed.
5. Run the validation suite in order: tsc → build → curl smoke → Playwright.
6. Fix any type errors or build failures. If a track's code causes failures, refer back to the track brief's acceptance criteria.
7. Add changelog entry.
8. Add header comments to files modified across tracks.

## Acceptance Criteria

- [ ] All four tracks' code is merged and functional
- [ ] SettingsContext has both `selectedInstrument` and `lockoutPermission` fields
- [ ] DayCard has multi-week cycling, "Trading Window" label, lock button with shimmer
- [ ] TopHeader has both lock button consolidation and @dnd-kit toolbar
- [ ] `npx tsc --noEmit` passes on both frontend and mobile
- [ ] `rm -rf dist && npx vite build` passes on both frontend and mobile
- [ ] `cd backend-hono && bun run build` passes
- [ ] All curl smoke tests return 200
- [ ] Changelog entry added, no S65 entries modified
- [ ] Local backend restarted and healthy

## Validation Commands

```bash
# Full suite (run from repo root)
npx tsc --noEmit --project frontend/tsconfig.json && \
rm -rf dist && npx vite build
```

```bash
cd mobile && npx tsc --noEmit && rm -rf dist && npx vite build
```

```bash
cd backend-hono && bun run build
```

```bash
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3
curl -s http://localhost:8080/api/diagnostics
curl -s http://localhost:8080/api/lockout/status
curl -s "http://localhost:8080/api/market-data/iv-score?symbol=%2FNQ" | head -c 300
```

## Commit Format

```
[v6.2.0] chore: S66 unification and validation — release suite merged
```
