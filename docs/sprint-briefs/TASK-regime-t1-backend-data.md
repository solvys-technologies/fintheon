# Task Brief: Regime Tracker T1 — Backend Data Layer

**Date:** 2026-04-14
**Scope:** Add COT data service, ORB price polling, volume spike detection, and antilag confidence blending to the backend
**Estimated files:** 6 new + 3 modified

## Context

The regime tracker's confidence scores are currently static numbers set manually in seed data. This track adds real data sources — CFTC Commitment of Traders reports, Yahoo Finance intraday price polling for ORB direction, and volume spike detection — then blends them with the existing IV scorer into a single "antilag confidence" score (0-100). This powers Track 2's frontend display.

## Files to Read First

- `backend-hono/src/services/market-data/yahoo-market.ts` — Existing Yahoo Finance client. Has `getIntradayBars()` and `getQuote()`. Reuse these for ORB pricing and volume data. No API key needed.
- `backend-hono/src/services/market-data/iv-scorer.ts` — Blended IV score service (0-10). Has `BlendedIVScore` interface with VIX, headline, MiroShark, systemic, and prediction components. The new `calculateRegimeConfidence()` export goes here.
- `backend-hono/src/services/market-data/iv-prediction.ts` — Heuristic next-session forecast. Exports `IVPrediction` with `confidence` (0-1). Reuse this as one input to the blended regime confidence.
- `backend-hono/src/routes/regimes/index.ts` — Current trading regime routes. Has its own inline `TradingRegime` type with old `wins/losses` record (not yet migrated to v2). Needs fade bias removed.
- `backend-hono/src/routes/market-data/index.ts` — Market data route factory. New COT route goes alongside existing `/iv-score`.
- `backend-hono/src/routes/index.ts` — Central route registration. No new top-level route groups needed — COT goes under `/api/market-data`, regime confidence under `/api/regime`.
- `backend-hono/src/routes/regime/index.ts` — Market regime routes (CRUD + detect). New confidence endpoint goes here.

## What to Build/Change

### 1. COT Types

- **Path:** `backend-hono/src/services/market-data/cot-types.ts`
- **Action:** Create
- **Spec:** Define `COTData` interface with fields: `instrument` (string), `reportDate` (string YYYY-MM-DD), `commercialNet` (number), `nonCommercialNet` (number), `managedMoneyNet` (number), `weekOverWeekChange` (number), `signal` ("bullish" | "bearish" | "neutral"), `signalStrength` (0-1 number), `fetchedAt` (string ISO). Also define `ORBResult` interface with: `instrument` (string), `openPrice` (number), `price10Min` (number), `direction` ("bullish" | "bearish"), `changeBps` (number), `changePercent` (number), `timestamp` (string ISO).
- **Max lines:** 40

### 2. COT Data Service

- **Path:** `backend-hono/src/services/market-data/cot-service.ts`
- **Action:** Create
- **Spec:**
  - Fetch CFTC COT reports from `https://publicreporting.cftc.gov/resource/jun7-fc8e.json` (disaggregated futures, Socrata API)
  - Filter for CME E-mini S&P 500 (contract code `13874A`) and CME E-mini Nasdaq (contract code `209742`)
  - Parse: `posi_comm_net = comm_positions_long_all - comm_positions_short_all`, same for non-commercial and managed money
  - Calculate `signalStrength`: normalize managed money net position against historical range (simple min-max over recent 52 weeks). >0.6 = bullish, <0.4 = bearish, else neutral
  - In-memory cache with 24h TTL (data only updates weekly on Fridays for prior Tuesday)
  - Fallback: if CFTC API fails, return last cached value or `{ signal: "neutral", signalStrength: 0.5 }`
  - Export: `getCOTPositioning(instrument: string): Promise<COTData>`
  - Use `fetch()` with 8s timeout. No external dependencies.
- **Max lines:** 120

### 3. ORB Price Service

- **Path:** `backend-hono/src/services/market-data/orb-price-service.ts`
- **Action:** Create
- **Spec:**
  - Import `getIntradayBars` from `./yahoo-market.js`
  - `getORBDirection(instrument: string, startTimeET: string): Promise<ORBResult>`: Given instrument (e.g. "/NQ" → Yahoo symbol "NQ=F") and regime start time (HH:MM ET), fetch 1-min intraday bars, find the bar at start time and the bar 10 min later, compute direction and change in bps
  - Symbol mapping: `/NQ` → `NQ=F`, `/ES` → `ES=F`, `/MNQ` → `MNQ=F`
  - If bars are missing for the exact minute, use nearest available bar
  - Export: `getORBDirection`, `futuresSymbolMap`
- **Max lines:** 80

### 4. Volume Spike Service

- **Path:** `backend-hono/src/services/market-data/volume-spike-service.ts`
- **Action:** Create
- **Spec:**
  - Import `getIntradayBars` from `./yahoo-market.js`
  - `getVolumeSpikeSignal(instrument: string, startTime: string, endTime: string): Promise<{ signal: number; currentVolume: number; avgVolume: number }>`
  - Fetch 5d of intraday bars at 1m interval, filter bars within the time window, compute average volume for that window across prior days, compare today's volume
  - Signal: `Math.min(1, currentVolume / (avgVolume * 2))` — so 2x average = signal 1.0, 1x average = signal 0.5
  - If no data available, return `{ signal: 0.3, currentVolume: 0, avgVolume: 0 }` (neutral fallback)
- **Max lines:** 80

### 5. Antilag Confidence Blending

- **Path:** `backend-hono/src/services/market-data/iv-scorer.ts`
- **Action:** Modify (add new export at bottom of file)
- **Spec:**
  - Add new exported function `calculateRegimeConfidence(params: { instrument: string; startTime: string; endTime: string }): Promise<{ antilagConfidence: number; breakdown: { iv: number; prediction: number; cot: number; volume: number } }>`
  - Formula: `antilagConfidence = Math.round((0.35 * ivNorm + 0.25 * predConf + 0.25 * cotStrength + 0.15 * volSignal) * 100)`
  - `ivNorm` = fetch current BlendedIVScore, divide score by 10 (normalize to 0-1)
  - `predConf` = fetch IVPrediction.confidence (already 0-1)
  - `cotStrength` = getCOTPositioning(instrument).signalStrength (0-1)
  - `volSignal` = getVolumeSpikeSignal(instrument, startTime, endTime).signal (0-1)
  - Return both the composite score AND individual components so frontend can show breakdown
  - Wrap each sub-call in try/catch — if any fails, use 0.5 (neutral) for that component
- **Max lines:** 50 (added to existing file)

### 6. Route Wiring

- **Path:** `backend-hono/src/routes/market-data/index.ts`
- **Action:** Modify
- **Spec:** Add `router.get("/cot/:instrument", handleCOT)` — handler calls `getCOTPositioning` and returns JSON

- **Path:** `backend-hono/src/routes/market-data/handlers.ts`
- **Action:** Modify
- **Spec:** Add `handleCOT` handler that reads `c.req.param("instrument")`, calls `getCOTPositioning("/" + instrument)`, returns `c.json(data)`

- **Path:** `backend-hono/src/routes/regime/index.ts` (or handlers)
- **Action:** Modify
- **Spec:** Add `POST /api/regime/confidence` route — reads `{ instrument, startTime, endTime }` from body, calls `calculateRegimeConfidence()`, returns JSON with `{ antilagConfidence, breakdown }`

- **Path:** `backend-hono/src/routes/regimes/index.ts`
- **Action:** Modify
- **Spec:** Update inline `TradingRegime` type: change `record: { wins; losses }` to `record: { bullishDays; bearishDays }`. Replace all `bias: "fade"` with `bias: "reversal"` in SEED_REGIMES. Update `bias` type comment to note valid values: continuation, reversal, convergence, consolidation, rotation.

## Key Rules

- Import paths use `.js` extension (ESM project: `import { x } from "./y.js"`)
- Use `fetch()` with `AbortSignal.timeout()` for HTTP calls (pattern from `yahoo-market.ts`)
- No `require()` — project is `type: "module"`
- Error handling: wrap external API calls in try/catch, log with `console.error`, return neutral fallbacks
- Do NOT touch the frontend — that's Track 2's job
- All timestamps in ET for regime time comparisons

## DO NOT

- Touch any frontend files
- Add new npm/bun dependencies — only use built-in `fetch()`
- Create new Supabase tables (COT caching is in-memory only for now)
- Modify the existing `calculateBlendedIVScore()` function — add the new `calculateRegimeConfidence()` as a separate export
- Touch files outside `backend-hono/src/`

## Verification

```bash
cd backend-hono && bun run build
# Should compile with no errors

# Test COT endpoint
curl http://localhost:8080/api/market-data/cot/ES

# Test regime confidence
curl -X POST http://localhost:8080/api/regime/confidence \
  -H "Content-Type: application/json" \
  -d '{"instrument":"/NQ","startTime":"09:30","endTime":"09:45"}'

# Test that existing routes still work
curl http://localhost:8080/api/regimes/active
curl http://localhost:8080/api/market-data/iv-score
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T18:00:00',
  agent: 'claude-code',
  summary: 'T1: Added COT data service (CFTC weekly reports), ORB price service (Yahoo Finance), volume spike detection, and antilag confidence blending to regime tracker backend',
  files: ['backend-hono/src/services/market-data/cot-service.ts', 'backend-hono/src/services/market-data/cot-types.ts', 'backend-hono/src/services/market-data/orb-price-service.ts', 'backend-hono/src/services/market-data/volume-spike-service.ts', 'backend-hono/src/services/market-data/iv-scorer.ts', 'backend-hono/src/routes/market-data/index.ts', 'backend-hono/src/routes/regimes/index.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
