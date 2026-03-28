# S5-T4: Market Impact Cron — Yahoo Finance Daily Close Pipeline

**Sprint:** S5 — NarrativeFlow Intelligence Map
**Track:** T4 (Backend — Data Pipeline)
**Depends On:** T1 types (for `marketImpact` shape — can define inline if T1 not done)
**Parallel With:** T2, T3, T5

---

## Context

RiskFlow scored items with HIGH/CRITICAL priority (macro_level >= 3) need market impact data attached — the NQ, ES, and YM daily close performance (points + percent change) for the day the event occurred. This enables the Sanctum's Econ Intel KPI cards to show how each event actually moved the market.

**Pipeline:** Nightly cron (6 PM ET) → find items >24h old without market_impact → fetch daily close from Yahoo Finance → write back to `scored_riskflow_items`.

---

## Files to Read First

- `backend-hono/src/services/supabase-service.ts` — ScoredRiskFlowItem type, read/write functions
- `backend-hono/src/services/cron/dispatch-scheduler.ts` — existing cron pattern
- `backend-hono/src/services/cron/econ-enricher.ts` — existing enrichment cron pattern
- `backend-hono/src/services/market-data/yahoo-market.ts` — existing Yahoo Finance integration
- `backend-hono/src/types/riskflow.ts` — FeedItem types

---

## Task 1: Yahoo Finance Daily Close Fetcher

**File:** `backend-hono/src/services/market-data/daily-close-service.ts` (create, max 120 lines)

Fetches daily OHLC close data for NQ, ES, YM futures from Yahoo Finance.

```typescript
interface DailyClose {
  symbol: string;
  date: string;        // ISO date
  close: number;
  prevClose: number;
  change: number;      // points
  changePercent: number; // percent
}

/**
 * Fetch daily close data for a specific date.
 * Uses Yahoo Finance chart API with 1d interval.
 *
 * Symbols:
 *   NQ=F (Nasdaq 100 futures)
 *   ES=F (S&P 500 futures)
 *   YM=F (Dow futures)
 */
export async function fetchDailyClose(
  date: string, // ISO date YYYY-MM-DD
): Promise<{ nq: DailyClose | null; es: DailyClose | null; ym: DailyClose | null }>
```

Use the Yahoo Finance chart endpoint:
```
https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?period1={unix}&period2={unix+86400}&interval=1d
```

Convert the response to `DailyClose` objects. Handle weekends/holidays (return null if no data for date).

Rate limiting: 1 request per second across all symbols. Use a simple delay between fetches.

---

## Task 2: Market Impact Cron Job

**File:** `backend-hono/src/services/cron/market-impact-enricher.ts` (create, max 150 lines)

Nightly cron that enriches scored items with market impact data.

```typescript
/**
 * Runs nightly at 6 PM ET (22:00 UTC).
 * Finds scored_riskflow_items with macro_level >= 3, older than 24h,
 * that don't have market_impact data yet. Fetches daily close for each
 * event date and writes back.
 */
export async function runMarketImpactEnrichment(): Promise<{ processed: number; enriched: number; errors: number }>
```

**Pipeline:**
1. Query Supabase: `scored_riskflow_items` where `macro_level >= 3` AND `market_impact IS NULL` AND `created_at < NOW() - INTERVAL '24 hours'`
2. Group items by date (multiple items on same day share the same close data)
3. For each unique date, call `fetchDailyClose(date)`
4. Write `market_impact` JSONB to each item:
   ```json
   {
     "nq": { "points": -465, "percent": -1.96 },
     "es": { "points": -120, "percent": -2.12 },
     "ym": { "points": -890, "percent": -2.05 },
     "asOf": "2025-04-02"
   }
   ```
5. Batch update to Supabase (upsert by tweet_id)

**Limits:**
- Process max 50 items per run (avoid rate limiting)
- Skip dates older than 365 days (Yahoo Finance historical limit)
- Log: `[MarketImpact] Enriched {n}/{total} items across {dates} dates`

---

## Task 3: Register Cron in Dispatch Scheduler

**File:** `backend-hono/src/services/cron/dispatch-scheduler.ts` (modify)

Add the market impact enrichment to the existing cron scheduler:

```typescript
// Add import
import { runMarketImpactEnrichment } from './market-impact-enricher.js';

// Add to DispatchJob array (after existing jobs):
{
  name: 'market-impact-enricher',
  cronExpression: '0 22 * * *', // 6 PM ET = 22:00 UTC
  handler: async () => {
    const result = await runMarketImpactEnrichment();
    console.log(`[Dispatch] Market impact: ${result.enriched}/${result.processed} enriched, ${result.errors} errors`);
  },
}
```

---

## Task 4: Add market_impact Column Support

**File:** `backend-hono/src/services/supabase-service.ts` (modify)

Add a function to update market_impact on scored items:

```typescript
export async function writeMarketImpact(
  tweetIds: string[],
  impactByDate: Map<string, Record<string, unknown>>,
): Promise<number>
```

Also ensure `readScoredItems` includes `market_impact` in its select if not already selecting `*`.

---

## Task 5: Backfill Script (One-Time)

**File:** `backend-hono/scripts/backfill-market-impact.ts` (create, max 80 lines)

A standalone script to backfill historical items:

```bash
cd backend-hono && npx tsx scripts/backfill-market-impact.ts
```

Runs `runMarketImpactEnrichment()` in a loop until all eligible items are processed (with 2-second delay between batches to respect rate limits).

---

## Verification

```bash
# Type-check backend
cd backend-hono && npx tsc --noEmit

# Verify new files
ls -la backend-hono/src/services/market-data/daily-close-service.ts backend-hono/src/services/cron/market-impact-enricher.ts

# Verify cron registration
grep -n "market-impact" backend-hono/src/services/cron/dispatch-scheduler.ts

# Test Yahoo Finance fetch (manual)
curl -s "https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?period1=1743552000&period2=1743638400&interval=1d" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['chart']['result'][0]['indicators']['quote'][0]['close'])" 2>/dev/null || echo "Yahoo API check"
```

---

## Changelog Entry

```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S5-T4: Market impact pipeline — nightly cron fetches NQ/ES/YM daily close from Yahoo Finance for HIGH/CRITICAL scored items >24h. Writes market_impact JSONB to scored_riskflow_items. Backfill script for historical items.', files: ['backend-hono/src/services/market-data/daily-close-service.ts', 'backend-hono/src/services/cron/market-impact-enricher.ts', 'backend-hono/src/services/cron/dispatch-scheduler.ts', 'backend-hono/src/services/supabase-service.ts', 'backend-hono/scripts/backfill-market-impact.ts'] }
```

---

## DO NOT

- Do NOT modify frontend components — T2/T3 handle display
- Do NOT modify the scoring pipeline (central-scorer, feed-service) — separate concern
- Do NOT add new API routes — the data surfaces through existing endpoints (econ-history, riskflow/feed)
- Do NOT touch the mirofish service — separate concern
- Do NOT implement real-time streaming of market data — this is a nightly batch enrichment only
