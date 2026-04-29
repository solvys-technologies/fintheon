# Sprint Brief: T5 — S48 Unification + Validation

## Context

Tracks T1-T4 run in parallel on separate branches. This track merges all four, resolves interface mismatches, wires the `speculation-filter.ts` import from T2 into `content-guard.ts` (owned by T1), applies the Supabase migration, runs the full validation suite, and adds the changelog entry. Single agent, sequential — runs AFTER T1-T4 are complete.

## Branch Target

This track operates on the unified branch. Create `s48-unified` by merging T1→T2→T3→T4 in order, then apply the unification changes.

## Scope — Included

- [ ] Create `s48-unified` branch from `main` at `23129632`
- [ ] Merge T1 (`s48-t1-econ-data-layer`) into `s48-unified`
- [ ] Merge T2 (`s48-t2-kalshi-wire-treasury`) into `s48-unified`
- [ ] Merge T3 (`s48-t3-pipeline-ui-countdown`) into `s48-unified`
- [ ] Merge T4 (`s48-t4-layout-s47-deferred`) into `s48-unified`
- [ ] Wire `speculation-filter.ts` import into `content-guard.ts` (new gate in checkContentGuard order, after emoji filter gate at line 520)
- [ ] Wire Kalshi pipe into riskflow-worker Standard tier (import + call in `sources/index.ts`)
- [ ] Wire Treasury scraper into riskflow-worker Standard tier (import + call in `sources/index.ts`)
- [ ] Register pipeline + pipeline-stats routes in `routes/index.ts`
- [ ] Apply Supabase migration `20260429_pipeline_tracking.sql`
- [ ] Run backend: `cd backend-hono && bun run build`
- [ ] Run frontend: `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] Run frontend: `rm -rf dist && npx vite build`
- [ ] 300-line audit: verify no file exceeds 300 lines
- [ ] Restart local backend + smoke test endpoints
- [ ] Add changelog entry to `src/lib/changelog.ts`
- [ ] Add `// [claude-code 2026-04-29]` headers to substantially modified files

## Scope — Excluded (DO NOT TOUCH)

- Any structural changes to track outputs — this track WIRES, it does not rewrite
- Mobile PWA
- Electron shell
- Deploy (left to `/solvys-deploy`)

## Implementation Steps

### Step 1: Create Unified Branch + Merge

```bash
git checkout main
git pull
git checkout -b s48-unified
git merge s48-t1-econ-data-layer --no-edit
git merge s48-t2-kalshi-wire-treasury --no-edit
git merge s48-t3-pipeline-ui-countdown --no-edit
git merge s48-t4-layout-s47-deferred --no-edit
```

Resolve any merge conflicts (expected none, but if any occur, resolve manually).

### Step 2: Wire Speculation Filter into Content Guard

In `backend-hono/src/services/riskflow/content-guard.ts`:

1. Add import at top:

```typescript
import {
  isSpeculative,
  SPECULATION_DEMOTE_FACTOR,
} from "./speculation-filter.js";
```

2. In `checkContentGuard()` function (line 457), add a new gate after the existing non-FJ emoji filter (gate 5, lines 520-523) and before the "false" prefix gate (gate 6, lines 525-527):

```typescript
// Gate 5.5: Speculation/hedged-language filter (T2/S48)
const specAction = isSpeculative(headline, body ?? "");
if (specAction === "block") {
  if (verbose) log.verbose("dropped: speculative language");
  return { passed: false, reason: "speculative" };
}
if (specAction === "demote") {
  // Attach metadata for iv-scorer to apply demotion factor
  result.speculationDemote = true;
}
```

3. Add `speculationDemote?: boolean` to the `ContentGuardResult` type.

4. In `iv-scorer.ts`, check `result.speculationDemote` and apply `SPECULATION_DEMOTE_FACTOR` (0.7×) to the IV score when true.

Exception: items where `ingest_pipeline === "economic-calendar"` always pass (econ prints are confirmed data).

### Step 3: Wire Kalshi + Treasury into RiskFlow Worker

In `backend-hono/src/workers/riskflow-worker/sources/index.ts`:

1. Add import:

```typescript
import { pollKalshiWhaleAlerts } from "../../../services/riskflow/kalshi-feed-pipe.js";
import { pollTreasuryAuctions } from "../../../services/riskflow/treasury-feed.js";
```

2. In `runStandardTier()` (line 100), add after existing entries:

```typescript
// Kalshi whale alerts (Econ & Politics only) — after Macro handle fallbacks (line 145)
if (await isPipelineEnabled("kalshi-whale")) {
  try {
    const kalshiItems = await pollKalshiWhaleAlerts();
    if (kalshiItems.length > 0) await persistItems(kalshiItems, "standard");
  } catch (err) {
    log.warn("Kalshi whale poll failed", { error: String(err) });
  }
}

// Treasury auction results — after Kalshi (new, after line ~150)
if (await isPipelineEnabled("browser-harness")) {
  try {
    const treasuryItems = await pollTreasuryAuctions();
    if (treasuryItems.length > 0) await persistItems(treasuryItems, "standard");
  } catch (err) {
    log.warn("Treasury auction poll failed", { error: String(err) });
  }
}
```

### Step 4: Register Pipeline Routes

In `backend-hono/src/routes/index.ts`, add to the admin route group:

```typescript
// S48: Pipeline control
import { pipelineList, pipelineToggle } from "./admin/pipelines.js";
import { pipelineStats } from "./admin/pipeline-stats.js";

// Inside admin group:
adminGroup.get("/pipelines", pipelineList);
adminGroup.patch("/pipelines/:id", pipelineToggle);
adminGroup.get("/pipeline-stats", pipelineStats);
```

### Step 5: Apply Migration

```bash
# Apply via Supabase MCP or directly
cd backend-hono
# If using Supabase CLI:
supabase db push
# Or manually apply the SQL file:
# supabase/migrations/20260429_pipeline_tracking.sql
```

Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'raw_riskflow_items' AND column_name = 'ingest_pipeline';

SELECT * FROM ingest_pipeline_state;
-- Should return 6 rows (all enabled)
```

### Step 6: Full Build + Type Check

```bash
# Backend
cd backend-hono && bun run build

# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build
```

Fix any type errors before proceeding.

### Step 7: 300-Line Audit

```bash
# Check all modified files
for f in \
  backend-hono/src/services/riskflow/content-guard.ts \
  backend-hono/src/services/market-data/router.ts \
  backend-hono/src/services/arbitrum/seats.ts \
  frontend/components/chat/FintheonThread.tsx \
  frontend/components/consilium/AgentChattr.tsx \
  frontend/components/refinement/RefinementEngine.tsx; do
  wc -l "$f"
done

# If any file exceeds 300 lines:
# - Note it in the changelog as a known violation (v5.34.0 legacy)
# - Do NOT refactor in this sprint — those are separate sprints
```

Files already over 300 lines from v5.34.0:

- `market-data/router.ts` — 476 (legacy, separate refactor)
- `FintheonThread.tsx` — 670 (legacy, separate refactor)
- `AgentChattr.tsx` — 615 (legacy, separate refactor)
- `seats.ts` — 318 (legacy, separate refactor)

No NEW file must exceed 300 lines. No MODIFIED file should grow beyond its current line count substantially.

### Step 8: Restart Backend + Smoke Tests

```bash
# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Wait for backend to start
sleep 3

# Diagnostics
curl -s http://localhost:8080/api/diagnostics | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if d.get('status')=='healthy' else 'FAIL')"

# Pipeline endpoints
curl -s http://localhost:8080/api/admin/pipelines | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('pipelines',[])))"
# Expected: 6

curl -s "http://localhost:8080/api/admin/pipeline-stats?hours=24" | head -c 500

# RiskFlow feed
curl -s "http://localhost:8080/api/riskflow/feed?limit=3" | python3 -c "import json,sys; items=json.load(sys.stdin).get('items',[]); print(f'{len(items)} items in feed')"

# Econ active watch
curl -s "http://localhost:8080/api/econ/active-watch" | head -c 300

# Sources (should include method_breakdown)
curl -s "http://localhost:8080/api/riskflow/sources" | python3 -c "import json,sys; d=json.load(sys.stdin); print('method_breakdown:', bool(d.get('method_breakdown')))"
```

### Step 9: Changelog Entry

Add to `src/lib/changelog.ts`:

```typescript
{
  date: "2026-04-29T...",
  agent: "claude-code",
  summary:
    "S48: News Feed pipeline control + econ fix + Kalshi whale tracker + CountdownFuse. Phase 1 (T1): Fixed 5 blocking points in econ pipeline (table redirect, narrative gate, market relevance, sourceless purge, dead fetch path), 21-day FJ X timeline backfill, ingest_pipeline migration + pipeline_state table, pipeline-gate + pipeline-stats services, 6 API routes, Doctor X-cookie round-robin. Phase 2 (T2): Kalshi whale tracker → RiskFlow (Econ & Politics filter only), speculation-filter.ts module for wire noise, Treasury auction RSS scraper, UW agent prompt updates (Harper/Oracle/Feucht/Consul), Desk Plan CAO midnight pulse. Phase 3 (T3): PipelineHealth table replacing NotchedFuse Group Sensitivity, PipelineToggles, CountdownFuse (NothingFuse + beat/miss/par/blink/X-close state machine + floating mode), dev countdown test button, EconFilterEditor, web URL source section in CatalystStatsDrawer, error handling. Phase 4 (T4): App frame border (top + full + sidebar shadow), Strategium translate-x slide-out drawer, bulletin drag fluidity (PsychAssist parity), upload button removal, Sanctum duplicate chart + 50/50 hero fix, connector dead-entry cleanup, category pill removal. Unification (T5): Wired speculation-filter into content-guard, Kalshi+Treasury into worker, migration applied, full validation.",
  files: [
    // T1 files
    "supabase/migrations/20260429_pipeline_tracking.sql",
    "backend-hono/src/types/pipeline.ts",
    "backend-hono/src/services/pipeline-gate.ts",
    "backend-hono/src/services/pipeline-stats.ts",
    "backend-hono/src/services/riskflow/content-guard.ts",
    "backend-hono/src/services/riskflow/central-scorer.ts",
    "backend-hono/src/services/riskflow/econ-bridge.ts",
    "backend-hono/src/services/riskflow/scorer-tagging.ts",
    "backend-hono/src/services/riskflow/feed-service.ts",
    "backend-hono/src/services/riskflow/user-polling-registry.ts",
    "backend-hono/src/routes/admin/pipelines.ts",
    "backend-hono/src/routes/admin/pipeline-stats.ts",
    "backend-hono/src/routes/riskflow/handlers.ts",
    "backend-hono/src/routes/admin/riskflow-bulk.ts",
    "backend-hono/src/routes/index.ts",
    "backend-hono/scripts/backfill-econ-from-fj.ts",
    "backend-hono/src/workers/riskflow-worker/sources/x-handles-browser.ts",
    "backend-hono/src/workers/riskflow-worker/sources/agent-reach.ts",
    "backend-hono/src/workers/riskflow-worker/sources/browser-harness.ts",
    "backend-hono/src/services/riskflow/commentary-scraper.ts",
    "backend-hono/src/services/riskflow/economic-feed.ts",
    // T2 files
    "backend-hono/src/services/riskflow/kalshi-feed-pipe.ts",
    "backend-hono/src/services/riskflow/speculation-filter.ts",
    "backend-hono/src/services/riskflow/treasury-feed.ts",
    "backend-hono/src/services/desk-planner.ts",
    "backend-hono/src/services/ai/agent-instructions/harper.md",
    "backend-hono/src/services/ai/agent-instructions/oracle.md",
    "backend-hono/src/services/ai/agent-instructions/feucht.md",
    "backend-hono/src/services/ai/agent-instructions/consul.md",
    "backend-hono/src/workers/riskflow-worker/sources/index.ts",
    "backend-hono/src/boot/services.ts",
    // T3 files
    "frontend/components/refinement/PipelineHealth.tsx",
    "frontend/components/refinement/PipelineToggles.tsx",
    "frontend/components/refinement/RefinementEngine.tsx",
    "frontend/components/shared/CountdownFuse.tsx",
    "frontend/components/refinement/EconFilterEditor.tsx",
    "frontend/components/refinement/CatalystStatsDrawer.tsx",
    "frontend/hooks/usePipelineStats.ts",
    "frontend/hooks/usePipelineState.ts",
    "frontend/index.css",
    // T4 files
    "frontend/components/layout/MainLayout.tsx",
    "frontend/components/layout/TopHeader.tsx",
    "frontend/components/layout/NavSidebar.tsx",
    "frontend/components/narrative/Sanctum.tsx",
    "frontend/components/chat/FintheonComposer.tsx",
    "frontend/components/feed/RiskFlowDetailCard.tsx",
    "mobile/components/shared/SnapSheet.tsx",
    // Unification
    "src/lib/changelog.ts",
  ],
}
```

### Step 10: File Headers

Add `// [claude-code 2026-04-29]` header comment to all substantially modified files that don't already have a recent header.

Check existing headers before adding — files modified in v5.34.0 (2026-04-28) already have dated headers.

## Acceptance Criteria

- [ ] All 4 track branches merge cleanly into `s48-unified`
- [ ] `speculation-filter.ts` wired into `content-guard.ts` (new gate 5.5)
- [ ] Kalshi + Treasury wired into riskflow-worker Standard tier
- [ ] Pipeline routes registered in `routes/index.ts`
- [ ] `ingest_pipeline` column exists on both raw + scored tables
- [ ] `ingest_pipeline_state` table has 6 seeded rows
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes (zero errors)
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] No NEW file exceeds 300 lines (existing over-limit files noted as legacy)
- [ ] `/api/diagnostics` returns healthy
- [ ] `/api/admin/pipelines` returns 6 rows
- [ ] `/api/admin/pipeline-stats` returns per-pipeline data
- [ ] `/api/riskflow/feed` returns items
- [ ] `/api/riskflow/sources` includes `method_breakdown`
- [ ] Changelog entry added to `src/lib/changelog.ts`
- [ ] File headers added to substantially modified files

## Validation Commands

```bash
# Full validation suite (run from repo root after all merges)

# 1. Backend build
cd backend-hono && bun run build
cd ..

# 2. Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# 3. Frontend build
rm -rf dist && npx vite build

# 4. 300-line audit
for f in \
  backend-hono/src/services/pipeline-gate.ts \
  backend-hono/src/services/pipeline-stats.ts \
  backend-hono/src/services/riskflow/speculation-filter.ts \
  backend-hono/src/services/riskflow/kalshi-feed-pipe.ts \
  backend-hono/src/services/riskflow/treasury-feed.ts \
  backend-hono/src/services/desk-planner.ts \
  backend-hono/src/routes/admin/pipelines.ts \
  backend-hono/src/routes/admin/pipeline-stats.ts \
  frontend/components/refinement/PipelineHealth.tsx \
  frontend/components/refinement/PipelineToggles.tsx \
  frontend/components/refinement/EconFilterEditor.tsx \
  frontend/components/shared/CountdownFuse.tsx; do
  if [ -f "$f" ]; then wc -l "$f"; fi
done

# 5. Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3

# 6. Smoke tests
echo "=== Diagnostics ==="
curl -s http://localhost:8080/api/diagnostics | head -c 200
echo ""
echo "=== Pipelines ==="
curl -s http://localhost:8080/api/admin/pipelines | head -c 200
echo ""
echo "=== Pipeline Stats ==="
curl -s "http://localhost:8080/api/admin/pipeline-stats?hours=24" | head -c 200
echo ""
echo "=== RiskFlow Feed ==="
curl -s "http://localhost:8080/api/riskflow/feed?limit=3" | head -c 300
```

## Commit Format

```
[v5.35.0] feat: S48 unification — wired speculation-filter into content-guard, Kalshi+Treasury into worker, migration applied, full validation suite passes
```
