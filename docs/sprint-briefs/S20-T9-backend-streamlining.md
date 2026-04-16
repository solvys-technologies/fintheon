# Sprint Brief: T9 — Backend Streamlining

## Context

The backend boots ~70 services serially (hurts cold-start on Fly.io), has 3 files violating the 300-line rule (iv-scoring-v2.ts at 1954, central-scorer.ts at 1073, mobile SettingsPage.tsx at 618), 4 ingestion pipelines with duplicated patterns, 3 feature flag systems, and no service health registry.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

### Two-Phase Boot

- [ ] `backend-hono/src/boot/services.ts` — split into `bootCritical()` (before listen) + `bootBackground()` (after listen via queueMicrotask)
- [ ] Critical path: VIX polling, Central Scorer, Feed cache seed, IV Ticker
- [ ] Background: everything else (crons, agents, heartbeat, scrapers, etc.)

### File Size Splits

- [ ] `backend-hono/src/services/iv-scoring-v2.ts` (1954 lines) → new `services/iv-scoring/` directory:
  - `config.ts` — constants, instrument configs
  - `computation.ts` — core scoring logic
  - `instrument.ts` — per-instrument scoring
  - `systemic.ts` — systemic overlay computation
  - `ticker.ts` — interval scheduling + cache
  - `index.ts` — re-exports
- [ ] `backend-hono/src/services/riskflow/central-scorer.ts` (1073 lines) → pipeline modules:
  - `scorer-pipeline.ts` — main orchestration
  - `scorer-tagging.ts` — headline tagging
  - `scorer-watchlist.ts` — watchlist matching
  - `scorer-reactive.ts` — MiroShark reactive triggers
  - `scorer-agent-notes.ts` — agent note generation

### Ingestion Consolidation

- [ ] Create `backend-hono/src/services/ingestion/base-poller.ts` — shared poll/dedup/filter/write pattern
- [ ] Refactor `feed-poller.ts`, `commentary-scraper.ts`, `econ-rettiwt-poller.ts`, `exa-scheduled-monitor.ts` to use shared base

### Feature Flag Unification

- [ ] Create `backend-hono/src/services/feature-flag-service.ts` — single source reading from env vars + defaults
- [ ] Consolidate `config/feature-flags.ts` + `ENABLE_*` env vars + `FINTHEON_FEATURE_FLAGS` JSON blob

### Service Health Registry

- [ ] New `backend-hono/src/services/health-registry.ts` — services register last-run + error count
- [ ] Update `/health` endpoint to aggregate registry data

### Interval Tuning

- [ ] Aquarium: 30 min → 60 min
- [ ] Agent Notes: 3 min → 5 min
- [ ] Shared Memory Cleanup: 30 min → 60 min

## Scope — Excluded (DO NOT TOUCH)

- `agent-instructions/` (T1 owns)
- `miroshark-template.ts`, `miroshark-client.ts` (T2 owns)
- `oracle-research/` (T3 owns)
- `agent-memory/` (T4 owns)
- `mobile/` files (T6/T7 own)
- `frontend/` files (T1/T6 own)

## Known Issues to Preserve

- `boot/services.ts` is also modified by T3 (Oracle research) and T4 (outcome resolver). T9 runs in Wave 2 after T3/T4, so incorporate their additions into the two-phase split.
- `central-scorer.ts` has `[claude-code 2026-03-24]` comments marking intentional changes. Preserve these in the split files.
- `iv-scoring-v2.ts` is the active scoring engine — `iv-scorer.ts` in `analysis/` and `market-data/` are different (older) files. Don't confuse them.
- The feed poller has dynamic interval (60-180s based on market hours). The base poller abstraction must support this.
- `auto_stop_machines = 'stop'` in Fly.io means cold-start time matters. Two-phase boot directly improves this.

## Implementation Steps

### Two-Phase Boot

1. Identify critical-path services (must be ready before first HTTP request):
   - VIX polling (feeds IV scoring)
   - Central Scorer (feeds RiskFlow)
   - Feed cache seed (populates initial feed)
   - IV Ticker (feeds Context Bank)
2. Move everything else into `bootBackground()` called after `server.listen()`
3. Add timing logs: `log.info("Critical boot complete in Xms")` and `log.info("Background boot complete in Xms")`

### File Splits

4. For each oversized file:
   - Read the full file and identify logical boundaries
   - Create the new directory/files
   - Move code maintaining all imports and exports
   - Update all import paths across the codebase
   - Verify `bun run build` passes after each split

### Ingestion Consolidation

5. Identify shared patterns across the 4 pollers: interval scheduling, dedup via content hash, content guard filtering, write to raw_riskflow_items
6. Extract into `base-poller.ts` with source-specific config objects
7. Refactor each poller to use the shared base

### Feature Flags

8. Create `feature-flag-service.ts` with `getFlag(name, default)` that checks env → JSON blob → code defaults
9. Replace all `process.env.ENABLE_*` checks with `getFlag()` calls

### Health Registry

10. Create `health-registry.ts` with `register(serviceName)`, `recordRun(serviceName)`, `recordError(serviceName, err)`, `getStatus()`
11. Have each background service call `recordRun()` on success, `recordError()` on failure
12. Update `/health` endpoint to include registry data

## Acceptance Criteria

- [ ] Cold-start time measurably improved (server responds to `/health` before all crons start)
- [ ] `iv-scoring-v2.ts` no longer exists (split into `services/iv-scoring/` with all files under 300 lines)
- [ ] `central-scorer.ts` no longer exists (split into pipeline modules under 300 lines each)
- [ ] All 4 ingestion pollers use shared base
- [ ] Single `getFlag()` function replaces all 3 flag systems
- [ ] `/health` endpoint reports last-run timestamps for background services
- [ ] Aquarium runs every 60 min, Agent Notes every 5 min
- [ ] `cd backend-hono && bun run build` passes
- [ ] No runtime behavior changes (same outputs, same intervals, same data flow)

## Validation Commands

```bash
cd backend-hono && bun run build
# Deploy to Fly.io, measure cold-start: time curl https://fintheon.fly.dev/health
# Check /health response includes service registry data
grep -r "iv-scoring-v2" backend-hono/src/  # should return 0 (file gone)
grep -r "central-scorer" backend-hono/src/  # should only be in imports pointing to new modules
```
