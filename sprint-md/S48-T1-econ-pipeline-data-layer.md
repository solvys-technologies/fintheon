# Sprint Brief: T1 — Econ Pipeline Fix + Backfill + Data Layer

## Context

The economic calendar pipeline is completely broken — 5 blocking points prevent any econ prints from reaching the frontend. The `economic_events` table has been empty for ~21 days. The countdown widget (`EconCountdownModal.tsx`, built in S34-T8) is mounted but starved of data. This track fixes the pipeline, backfills 21 days of events from FinancialJuice's X timeline, and builds the data foundation for pipeline control (method field, pipeline state, gate service).

## Branch Target

`s48-t1-econ-data-layer` from `main` at `23129632`

## Scope — Included

- [ ] Fix 5 blocking points in econ pipeline (econ-bridge table redirect, scorer-tagging narrative gate, content-guard market relevance, central-scorer sourceless purge, feed-service dead fetch path)
- [ ] Backfill 21 days of econ events from FinancialJuice X timeline (X only, per TP policy)
- [ ] Supabase migration: `ingest_pipeline` column on `raw_riskflow_items` + `scored_riskflow_items`
- [ ] Supabase migration: `ingest_pipeline_state` table + seed rows (all 6 pipelines enabled)
- [ ] TypeScript: `IngestPipeline` enum + types
- [ ] `pipeline-gate.ts` service — gates ingest paths at entry
- [ ] `pipeline-stats.ts` service — per-pipeline headline count, errors, last success, uptime
- [ ] Set `ingest_pipeline` on all 6 ingest paths
- [ ] API: `GET /api/admin/pipelines` + `PATCH /api/admin/pipelines/:id`
- [ ] API: `GET /api/admin/pipeline-stats?hours=24`
- [ ] Extend `GET /api/riskflow/sources` with `method_breakdown`
- [ ] Extend `GET /api/admin/riskflow/source-stats` with `?type=web` filter
- [ ] Doctor button: add X cookie refresh to `user-polling-registry.ts` + round-robin rotation

## Scope — Excluded (DO NOT TOUCH)

- `kalshi-service.ts` (T2 owns Kalshi integration)
- `unusual-whales.ts` (T2 owns UW agent prompts)
- `RefinementEngine.tsx` (T3 owns frontend pipeline UI)
- `MainLayout.tsx`, `Sanctum.tsx`, `TopHeader.tsx` (T4 owns layout fixes)
- `speculation-filter.ts` (T2 writes it; this track imports it during T5 unification only)

## Reuse Inventory (existing code to call, not reinvent)

- `headline-parser.ts:209-224` (`parseEconData()`) — parses FJ tweet format "Actual X vs Forecast Y (Previous Z)"
- `rettiwt-poller-econ.ts` — `matchTweetToEvent()` matches FJ tweets to calendar events by keyword overlap
- `retiiwt-poller-econ.ts` — extraction patterns for Actual/Forecast/Previous from tweet text
- `fj-emoji-filter.ts` — FJ self-promo blacklist (tweets about "FinancialJuice |" etc. are blocked)
- `econ-bridge.ts:81-102` — `injectEconPrintToFeed()` writes econ prints (currently to wrong table: `news_feed_items`)
- `econ-bridge.ts:2-4` — already calls `broadcastEconPrint` SSE for countdown modal
- `scorer-tagging.ts:55-87` — `NARRATIVE_KEYWORDS` array (needs expansion for missing econ categories)
- `scorer-tagging.ts:169-188` — `normalizeSource()` (handles `"EconomicCalendar"` source bucket)
- `central-scorer.ts:254-287` — narrative gate calls `matchesAnyNarrative()`
- `central-scorer.ts:682-735` — sourceless purge with `TRUSTED_SOURCELESS` array
- `content-guard.ts:116-117` — `MARKET_KEYWORDS` regex (needs TradingView descriptive titles)
- `content-guard.ts:536-537` — `lacksMarketRelevance()` gate
- `feed-service.ts:297-314` — `warmCacheFromDB()` reads from `scored_riskflow_items`
- `feed-service.ts:486-495` — `X_PRIMARY_SOURCES` set + `NON_X_IV_CAP = 7`
- `feed-service.ts:685-693` — `TRUSTED_SOURCELESS` array (missing `"EconomicCalendar"`)
- `feed-service.ts:897-904` — legacy `news_feed_items` fallback (only fires when scored table is empty)
- `feed-service.ts:915` — `fetchFreshFeed()` dead code — only runs as last-resort fallback
- `economic-feed.ts:17-97` — creates `FeedItem` from Supabase econ_calendar table
- `economic-feed.ts:80-94` — econ items created with NO `url` field
- `econ-calendar-populator.ts:387-406` — calls `injectEconPrintToFeed()` hourly 9-17 ET weekdays
- `user-polling-registry.ts` — `recordUserPollSuccess/Attempt` helpers
- `source-accounts-service.ts:83-85` — `getWireHandles()` returns active Wire category accounts
- `source-accounts-service.ts:93-95` — `getMacroHandles()` returns active Macro category accounts

## Known Issues to Preserve

- Rettiwt is inert (all functions hardwired no-op since S27-T4). Do NOT attempt to re-enable.
- Feed poller + Agent Reach poller are dead-wired (not started in boot since S46.3). Do NOT start them.
- `fintheon-riskflow-worker` is the sole writer to `raw_riskflow_items`. Its three-tier chain (syndication → XActions → Nitter) is broken at the upstream level. This track does NOT fix upstream failures — it only gates pipelines that are downstream.
- `commentary_transcripts` migration was deferred in v5.34.0. Leave deferred.
- Xquik-dev/x-twitter-scraper is TP-vetoed. Do not reference.

## Implementation Steps

### Step 1: Database Migration

Create `supabase/migrations/20260429_pipeline_tracking.sql`:

```sql
-- Add ingest_pipeline to raw items
ALTER TABLE raw_riskflow_items ADD COLUMN IF NOT EXISTS ingest_pipeline text;

-- Add ingest_pipeline to scored items
ALTER TABLE scored_riskflow_items ADD COLUMN IF NOT EXISTS ingest_pipeline text;

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_raw_ingest_pipeline_created
  ON raw_riskflow_items(ingest_pipeline, created_at);

-- Pipeline toggle state table
CREATE TABLE IF NOT EXISTS ingest_pipeline_state (
  pipeline_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- Seed default rows
INSERT INTO ingest_pipeline_state (pipeline_id, enabled) VALUES
  ('x-syndication', true),
  ('xactions', true),
  ('agent-reach-nitter', true),
  ('browser-harness', true),
  ('rettiwt-commentary', true),
  ('economic-calendar', true)
ON CONFLICT (pipeline_id) DO NOTHING;
```

### Step 2: TypeScript Types

Create `backend-hono/src/types/pipeline.ts`:

```typescript
export const INGEST_PIPELINES = [
  "x-syndication",
  "xactions",
  "agent-reach-nitter",
  "browser-harness",
  "rettiwt-commentary",
  "economic-calendar",
  "kalshi-whale", // T2 will use this
] as const;
export type IngestPipeline = (typeof INGEST_PIPELINES)[number];

export interface PipelineState {
  pipeline_id: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface PipelineStats {
  pipeline_id: string;
  headline_count: number;
  error_count: number;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  uptime_pct: number;
}
```

Add `ingest_pipeline?: IngestPipeline` to the `FeedItem` and `ScoredFeedItem` types (in their respective type files).

### Step 3: Fix Econ Pipeline — 5 Blocking Points

**Fix 1 — Table redirect (`econ-bridge.ts:81-102`):**

The `injectEconPrintToFeed()` function writes to `news_feed_items` (legacy table) but the feed API reads from `scored_riskflow_items`. Change to write to `raw_riskflow_items` with `source: "EconomicCalendar"` and `ingest_pipeline: "economic-calendar"`. Also set `url: ""` (empty string) so the sourceless purge fix works. Add `isPipelineEnabled("economic-calendar")` gate at entry.

**Fix 2 — Narrative gate (`scorer-tagging.ts:55-87`):**

Add missing econ categories to `NARRATIVE_KEYWORDS`:

- `gdp` → `\bgdp\b` (match "Gross Domestic Product")
- `industrial\s*production` → `\bindustrial\s+production\b`
- `consumer\s*confidence` → `\bconsumer\s+confidence\b`
- `ism` → `\bism\b` (match ISM Manufacturing/Services PMI)
- `retail\s*sales` → `\bretail\s+sales\b`
- `trade\s*balance` → `\btrade\s+balance\b`
- `durable\s*goods` → `\bdurable\s+goods\b`
- `building\s*permits` → `\bbuilding\s+permits\b`

New keyword entry example:

```
{ narrative: "gdp", regex: /\bgdp\b/i },
{ narrative: "industrial-output", regex: /\bindustrial\s+production\b/i },
{ narrative: "consumer-sentiment", regex: /\bconsumer\s+(?:confidence|sentiment)\b/i },
{ narrative: "manufacturing-pmi", regex: /\b(?:ism|pmi|manufacturing)\s*(?:pmi|manufacturing|services)\b/i },
{ narrative: "retail-activity", regex: /\bretail\s+sales\b/i },
{ narrative: "trade-flows", regex: /\btrade\s+balance\b/i },
{ narrative: "capital-goods", regex: /\bdurable\s+goods\b/i },
{ narrative: "housing-activity", regex: /\bbuilding\s+permits\b/i },
```

**Fix 3 — Market relevance gate (`content-guard.ts:536-537`):**

The `MARKET_KEYWORDS` regex at line 116-117 uses abbreviated codes (CPI, PPI, GDP, NFP, FOMC). TradingView event titles use descriptive names. Add descriptive variants to the regex:

```typescript
// Add these to MARKET_KEYWORDS (line 116):
Gross Domestic Product|Consumer Price Index|Producer Price Index|
ISM Manufacturing|ISM Services|Retail Sales|Trade Balance|
Durable Goods|Building Permits|Housing Starts|Industrial Production|
Jobless Claims|Consumer Confidence|Michigan Sentiment|JOLTS|
Average Hourly Earnings|Employment Cost Index
```

**Fix 4 — Sourceless purge (`central-scorer.ts:685-693`):**

Add `"EconomicCalendar"` to `TRUSTED_SOURCELESS` array:

```typescript
const TRUSTED_SOURCELESS = [
  "FinancialJuice",
  "DeItaOne",
  "TwitterCli",
  "OSINTSources",
  "Hermes",
  "EconomicCalendar", // NEW
];
```

**Fix 5 — Dead fetch path (`feed-service.ts:915`):**

`fetchFreshFeed()` (lines 747-793) handles econ items but is only called as a last-resort fallback at line 915. Wire it into the regular feed refresh cycle. The simplest fix: call `fetchFreshFeed()` during `warmCacheFromDB()` after the scored-items cache is seeded, merging econ items from `raw_riskflow_items` that have `ingest_pipeline = "economic-calendar"`.

### Step 4: Backfill 21 Days from FJ X Timeline

Create `backend-hono/scripts/backfill-econ-from-fj.ts`:

1. Calculate date range: `(today - 21 days)` to `today`
2. For each date in the range:
   - Build a list of expected event names from the catalog (CPI, NFP, PPI, GDP, ISM, Retail Sales, etc. — 14 event types from the econ catalog)
   - Use `rettiwt-poller-econ.ts` helpers (`matchTweetToEvent`, Actual/Forecast/Previous extraction patterns)
   - Query FinancialJuice's X timeline (via the existing X pipeline, not the website)
   - Match tweets to expected events by keyword overlap
3. Parse Actual/Forecast/Previous from matched tweets using `headline-parser.ts:parseEconData()`
4. Upsert into `economic_events` using SHA-256 `event_key` for idempotency:
   ```
   event_key = sha256("{name}|{date}|{time}|{country}")
   ```
5. Log results: events found, events missing, events with partial data
6. Run as: `cd backend-hono && bun run scripts/backfill-econ-from-fj.ts`

The event catalog to poll for (priority order):

- NFP (first Friday of the month)
- CPI m/m (usually ~10th)
- PPI m/m (usually ~11th)
- FOMC Rate Decision
- ISM Manufacturing PMI (1st business day)
- ISM Services PMI (3rd business day)
- GDP q/q Advance (quarterly)
- PCE m/m
- Retail Sales m/m
- Jobless Claims (every Thursday — 4 events in 21 days)
- ADP Employment
- JOLTS Job Openings
- Consumer Confidence (CB)
- Michigan Sentiment (UoM)

Total: ~35 events in 21 days.

### Step 5: Build Services

**`backend-hono/src/services/pipeline-gate.ts`** (new file, <150 lines):

```typescript
import { createLogger } from "../lib/logger.js";
import type { IngestPipeline } from "../types/pipeline.js";

const log = createLogger("PipelineGate");
const stateCache = new Map<string, boolean>();
let lastRefresh = 0;
const CACHE_TTL_MS = 30_000;

export async function isPipelineEnabled(
  pipelineId: IngestPipeline,
): Promise<boolean> {
  // Return cached value if fresh (<30s)
  const cached = stateCache.get(pipelineId);
  if (cached !== undefined && Date.now() - lastRefresh < CACHE_TTL_MS)
    return cached;
  // Fallback to true if cache miss or stale (don't break the feed)
  await refreshPipelineState();
  return stateCache.get(pipelineId) ?? true;
}

export async function refreshPipelineState(): Promise<void> {
  // Read from ingest_pipeline_state table, update Map
  // Degrade gracefully: return all true if table doesn't exist
}

export function clearPipelineCache(): void {
  stateCache.clear();
  lastRefresh = 0;
}
```

**`backend-hono/src/services/pipeline-stats.ts`** (new file, <150 lines):

```typescript
// Aggregate helpers: query raw_riskflow_items grouped by ingest_pipeline
// Count headlines, errors, last success per pipeline over N hours
// Fall back to empty stats if table doesn't exist
```

### Step 6: Set `ingest_pipeline` on All Ingest Paths

Modify each ingest path to:

1. Call `await isPipelineEnabled("x-syndication")` at entry. If false, return []/skip.
2. Set `ingest_pipeline` on every item before writing to `raw_riskflow_items`.

| File                                                                             | Pipeline ID            |
| -------------------------------------------------------------------------------- | ---------------------- |
| `workers/riskflow-worker/sources/x-handles-browser.ts` (syndication path)        | `"x-syndication"`      |
| `workers/riskflow-worker/sources/x-handles-browser.ts` (XActions path, line 273) | `"xactions"`           |
| `workers/riskflow-worker/sources/agent-reach.ts`                                 | `"agent-reach-nitter"` |
| `workers/riskflow-worker/sources/browser-harness.ts`                             | `"browser-harness"`    |
| `services/riskflow/commentary-scraper.ts`                                        | `"rettiwt-commentary"` |
| `services/riskflow/economic-feed.ts`                                             | `"economic-calendar"`  |
| `services/riskflow/econ-bridge.ts` (after Step 3 fix)                            | `"economic-calendar"`  |

### Step 7: Build API Routes

**`backend-hono/src/routes/admin/pipelines.ts`** (new file, <100 lines):

- `GET /api/admin/pipelines` — return all pipeline states from `ingest_pipeline_state`
- `PATCH /api/admin/pipelines/:id` — toggle `enabled`, update `updated_at` + `updated_by`
- Auth: super-admin gated (SUPER_ADMIN_USER_ID or DB role)

**`backend-hono/src/routes/admin/pipeline-stats.ts`** (new file, <100 lines):

- `GET /api/admin/pipeline-stats?hours=24` — return per-pipeline aggregate stats
- Auth: super-admin gated

Register both in `backend-hono/src/routes/index.ts`:

```typescript
// Inside the admin route group
app.get("/admin/pipelines" /* handler */);
app.patch("/admin/pipelines/:id" /* handler */);
app.get("/admin/pipeline-stats" /* handler */);
```

### Step 8: Extend Existing Endpoints

**`GET /api/riskflow/sources`** (in `routes/riskflow/handlers.ts`):
Add `method_breakdown` to response: count of items per `ingest_pipeline` value from `scored_riskflow_items`.

**`GET /api/admin/riskflow/source-stats`** (in `routes/admin/riskflow-bulk.ts`):
Add `?type=web` query param filter — only return sources where `polling_type === "web"`.

### Step 9: Doctor Button X-Cookie Refresh

In `routes/riskflow/handlers.ts:1322-1389` (`POST /api/riskflow/doctor`):

- Add X cookie refresh step: if the requesting user has an X session cookie in their Electron instance, forward it via IPC → backend
- Update `user-polling-registry.ts`: add `cookieRefreshedAt` field per user
- Implement round-robin: rotate the active X cookie across all team members with valid cookies, on an hourly cycle
- Track `totalContributions` and `currentlyOwner` per user (these fields already exist)

### Step 10: Wipe and Restart Countdown Data

After fixing the pipeline, the econ events will flow. Verify `GET /api/econ/active-watch` returns events. Verify `broadcastEconPrint` SSE fires on new prints. The `EconCountdownModal.tsx` (mounted in `RiskFlowMain.tsx:168`) will pick up events automatically.

## Acceptance Criteria

- [ ] `ingest_pipeline` column exists on both `raw_riskflow_items` and `scored_riskflow_items`
- [ ] `ingest_pipeline_state` table exists with 6 seeded rows
- [ ] `isPipelineEnabled()` returns correct state for each pipeline
- [ ] Econ prints survive all 5 blocking points and reach `scored_riskflow_items`
- [ ] 21-day backfill populates `economic_events` with ≥70% event coverage
- [ ] Each ingest path sets `ingest_pipeline` before writing to DB
- [ ] `GET /api/admin/pipelines` returns 6 rows
- [ ] `PATCH /api/admin/pipelines/econ-calendar` toggles enabled → econ prints stop
- [ ] `GET /api/admin/pipeline-stats?hours=24` returns per-pipeline counts
- [ ] `GET /api/riskflow/sources` includes `method_breakdown`
- [ ] Doctor button refreshes X cookie for requesting user
- [ ] Backfill script runs without errors
- [ ] `cd backend-hono && bun run build` passes
- [ ] No file exceeds 300 lines (split on growth)
- [ ] T5 unification passes full validation suite

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke tests
curl -s http://localhost:8080/api/diagnostics | head -c 200
curl -s http://localhost:8080/api/admin/pipelines | head -c 200
curl -s http://localhost:8080/api/admin/pipeline-stats?hours=24 | head -c 200
curl -s "http://localhost:8080/api/riskflow/sources" | head -c 500
curl -s "http://localhost:8080/api/econ/active-watch" | head -c 500

# Run backfill (dry-run first)
cd backend-hono && DRY_RUN=true bun run scripts/backfill-econ-from-fj.ts
```

## Commit Format

```
[v5.35.0] feat: T1 econ pipeline fix + backfill + data layer — fixed 5 blocking points, 21-day FJ X backfill, ingest_pipeline migration, pipeline-gate service, Doctor X-cookie refresh
```
