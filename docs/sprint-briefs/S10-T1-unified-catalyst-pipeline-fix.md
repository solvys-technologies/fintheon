# S10-T1: Unified Catalyst Pipeline Fix

## Problem Statement

The Catalyst pipeline is broken in 3 critical ways:

1. **Feed returns 1/100 items** — `scored_riskflow_items` has ~100 rows, but the watchlist `source` filter kills 99 of them. Items ingested from Twitter CLI get source labels like `"FinancialJuice"` (from the tweet account) but the watchlist only passes 4 hardcoded sources. The `matchesWatchlist()` source gate at `watchlist-service.ts:84` is the bottleneck.

2. **AutoPolling toggle doesn't stop X API calls** — Rate limited (429) during this session. The toggle in Refinement Engine needs to hard-kill polling, preserving only the static daily window (8AM-11AM ET). Right now the FeedPoller runs every 15s regardless.

3. **Catalyst data is fragmented** — Catalyst Cards (NarrativeMap), Catalyst Rows (RiskFlow), and Catalyst Tables (Sanctum/EconIntel) should all read from the same scored DB with the same scores, but NarrativeMap was recently rewired to read from RiskFlowContext while Sanctum still has its own briefing data path.

## Terminology (MANDATORY)

| Term | Feature | Presentation |
|------|---------|-------------|
| **Catalyst Cards** | NarrativeFlow/NarrativeMap | Cards on canvas |
| **Catalyst Rows** | RiskFlow feed | Scrollable list rows |
| **Catalyst Tables/Charts** | Sanctum / Econ Intelligence | Structured data views |

The underlying entity is always a **Catalyst** stored in `scored_riskflow_items`.

## Root Causes Found (this session)

### RC1: Watchlist source filter too restrictive
- **File**: `backend-hono/src/services/riskflow/watchlist-service.ts:84`
- **Issue**: `if (!watchlist.sources.includes(item.source)) return false;`
- Watchlist hardcodes: `["FinancialJuice", "InsiderWire", "EconomicCalendar", "Polymarket"]`
- Twitter CLI items get assigned source labels from the tweet's account/feed name
- 99/100 items fail because their source label doesn't match the 4 allowed values
- **Fix**: The scorer must normalize source labels during ingestion so they match the watchlist categories. A `@zerohedge` tweet about CPI = source `"FinancialJuice"`. An econ calendar tweet = source `"EconomicCalendar"`. etc.

### RC2: Supabase schema drift
- **Log evidence**: `Could not find the 'agent_note' column`, `column scored_riskflow_items.market_impact does not exist`
- The code references columns (`agent_note`, `econ_data`, `market_impact`) that don't exist in the actual Supabase schema
- `writeScoredItems` upserts fail silently because of missing columns
- **Fix**: Run migration to add missing columns, OR fix `scoredToFeedItem` / `central-scorer.ts` to only reference existing columns

### RC3: AutoPolling not gated
- **File**: `backend-hono/src/services/riskflow/feed-poller.ts` — polls every 15s
- The `autoRefresh` flag exists in frontend `RiskFlowContext` but the backend FeedPoller ignores it
- Twitter CLI gets rate-limited (429 seen in logs)
- **Fix**: Backend poller must check a toggle endpoint or config. Daily window: 8AM-11AM ET only. Outside that, poller sleeps.

### RC4: 7-day lookback (fixed this session)
- **File**: `backend-hono/src/services/riskflow/feed-service.ts:392`
- Was 48h, now 7 days. Already committed.

## Architecture (target state)

```
Twitter CLI / RSS / Scrapers / EconCalendar
        ↓ (raw catalysts)
   FeedPoller (8AM-11AM ET window, toggle-gated)
        ↓
   Central Scorer (OpenRouter Grok fallback chain)
        ↓ (scored + tagged + source-normalized)
   scored_riskflow_items (Supabase — ONE table, never delete)
        ↓
   Catalyst Promoter (30min delay → writes narrative_card_links)
        ↓
   Feed API (GET /api/riskflow/feed) ← ALL consumers read from here
        ↓
   ┌────────────────┬────────────────┬────────────────┐
   Catalyst Rows    Catalyst Cards   Catalyst Tables
   (RiskFlow)       (NarrativeMap)   (Sanctum/Econ)
```

## Tasks

### T1a: Fix source normalization in scorer
- In `central-scorer.ts`, when scoring raw items, normalize the `source` field to one of the 4 watchlist categories based on content/account mapping
- Twitter financial news accounts → `"FinancialJuice"`
- Econ data tweets → `"EconomicCalendar"`
- Political/geopolitical → `"InsiderWire"`
- Prediction markets → `"Polymarket"`
- Backfill existing 100 items with corrected source labels

### T1b: Fix Supabase schema
- Add missing columns: `agent_note`, `econ_data`, `market_impact` to `scored_riskflow_items`
- OR: Remove references to non-existent columns from the code (check which approach is correct)
- Verify `writeScoredItems` upserts succeed after fix

### T1c: AutoPolling toggle + daily window
- Backend FeedPoller: add time-of-day gate (8AM-11AM ET weekdays only)
- Wire frontend toggle (Refinement Engine) to backend endpoint that pauses/resumes the poller
- When toggle is OFF, ALL X API calls stop. Period.
- Test: toggle off → verify zero twitter-cli processes spawn

### T1d: Unify all frontend consumers
- Verify Catalyst Cards read from RiskFlowContext (already done in S9 unified pipeline)
- Verify Sanctum EconIntel reads from the same scored feed, not a separate data path
- All presentations must show the same underlying Catalyst data: same score, same tags, same sentiment

### T1e: Neon vs Supabase DB warning
- Backend logs: `[db] DATABASE_URL detected. Prefer NEON_DATABASE_URL.`
- Investigate: is the backend connecting to the right database? We migrated to Supabase — this warning suggests a leftover Neon/pg config
- Fix the connection config to use Supabase exclusively

## Files to Touch

| File | Change |
|------|--------|
| `backend-hono/src/services/riskflow/central-scorer.ts` | Source normalization |
| `backend-hono/src/services/riskflow/feed-poller.ts` | Daily window + toggle gate |
| `backend-hono/src/services/riskflow/feed-service.ts` | Already fixed (7-day lookback) |
| `backend-hono/src/services/supabase-service.ts` | Fix column references |
| `backend-hono/src/config/supabase.ts` | Check DB connection config |
| `supabase/migrations/` | New migration for missing columns |
| `frontend/components/settings/RiskFlowSettings.tsx` | Verify toggle wires to backend |
| `frontend/contexts/RiskFlowContext.tsx` | Verify single source of truth |

## Priority Order
1. T1b (schema fix) — unblocks everything
2. T1a (source normalization) — makes 100 items visible
3. T1c (polling toggle) — stops rate limiting immediately
4. T1d (frontend unification) — verification pass
5. T1e (DB connection) — housekeeping

## Test Plan
- [ ] Feed returns 50+ items after schema fix + source normalization
- [ ] Toggle OFF → zero twitter-cli processes for 5 minutes
- [ ] Toggle ON within 8-11AM window → polling resumes
- [ ] Toggle ON outside window → polling stays dormant
- [ ] Catalyst Cards show same score as Catalyst Rows for same item
- [ ] Items persist across backend restarts (never deleted)
- [ ] `writeScoredItems` logs no column errors
