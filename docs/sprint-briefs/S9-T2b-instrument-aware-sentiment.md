# S9-T2b: Instrument-Aware Sentiment Scoring

**Date:** 2026-03-29
**Scope:** Make RiskFlow sentiment context-aware per selected instrument — "drone strike on Iran" = bearish for /ES but bullish for /GC
**Estimated files:** 8

## Context
RiskFlow scores every headline with a single Bullish/Bearish direction that's always /ES-centric. When a user selects Gold (/GC) as their instrument, a geopolitical escalation headline still shows "BEARISH" — which is wrong. Gold is a safe haven; that headline is bullish for gold. The system needs to flip sentiment based on the event type × asset class relationship. Per-instrument scores must be stored in the backend for historical analysis per asset class. Additionally, the ▲/▼ direction arrows need to become ± (plus-minus) symbols — the arrows look like stock price direction icons and mislead less experienced traders.

**IMPORTANT**: T1 renamed components. Use NEW names:
- `RiskFlowPanel` → `RiskFlowMini` (file: `RiskFlowMini.tsx`)
- `NewsSection` → `RiskFlowMain` (file: `feed/RiskFlowMain.tsx`)

## Files to Read First
- `backend-hono/src/services/iv-scoring-v2.ts` (lines 573-601) — INSTRUMENT_BETAS table with betas for all instruments. Gold = 0.2, Bonds = -0.3. Also read `enforceSentiment()` at the bottom (~line 1112+) and `classifyEventType()` (~line 954+)
- `backend-hono/src/config/volatility-taxonomy.json` — Already has `instrumentOverrides` per event type (gold 1.5x on geopolitical, oil 1.8x on conflict, bonds 1.8x on fedDecision). These encode MAGNITUDE but not DIRECTION.
- `backend-hono/src/routes/riskflow/handlers.ts` (lines 108-150) — The feed handler already accepts `instrument` query param and re-estimates point magnitude per request. This is where sentiment flipping should also happen.
- `backend-hono/src/services/supabase-service.ts` — `ScoredRiskFlowItem` type and read/write functions. The `price_brain_score` JSONB field stores `{ sentiment, impliedPoints, instrument }`.
- `frontend/lib/riskflow-feed.ts` — `inferDirection()` function (line 186) — currently ignores instrument. `ensureScoring()` sets `alert.instrument` but doesn't use it for direction.
- `frontend/components/feed/RiskFlowDetailCard.tsx` — Direction display: `▲ BULLISH` / `▼ BEARISH` on lines 126-127, and `▲/▼ +X pts` on lines 237
- `frontend/components/RiskFlowMini.tsx` — `DirectionBadge` (line 92), footer direction (line 417-418), deviation indicators (line 452-454)
- `backend-hono/src/services/riskflow/central-scorer.ts` — `classifyRiskType()` categorizes headlines as Macro/Geopolitical/Earnings/etc.

---

## What to Build/Change

### 1. Asset Class Sentiment Flipper (backend — NEW)
- **Path:** `backend-hono/src/services/iv-scoring-v2.ts` (append to existing)
- **Action:** Add new section after `enforceSentiment()`
- **Spec:**

Create an `ASSET_CLASS_MAP` that groups instruments into classes:
```typescript
const ASSET_CLASS_MAP: Record<string, string> = {
  '/ES': 'equities', '/MES': 'equities', '/NQ': 'equities', '/MNQ': 'equities',
  '/YM': 'equities', '/MYM': 'equities', '/RTY': 'equities', '/M2K': 'equities',
  '/GC': 'safe-haven', '/MGC': 'safe-haven', '/SI': 'precious',  '/SIL': 'precious',
  '/CL': 'energy',    '/MCL': 'energy',    '/NG': 'energy',
  '/ZB': 'bonds',     '/ZN': 'bonds',
  '/6E': 'fx-major',  '/6J': 'fx-major',   '/6B': 'fx-major',
}
```

Create an `EVENT_SENTIMENT_REACTIONS` map. For each event category, define how each asset class reacts **relative to the equity sentiment**:
- `'same'` = same direction as equities
- `'inverse'` = opposite direction (bearish equities → bullish this)
- `null` = no override, use the raw equity sentiment as-is

Event categories to map (use `classifyRiskType()` output + `classifyEventType()` output):
| Event Category | Equities | Safe-Haven | Bonds | Energy | FX-Major |
|---|---|---|---|---|---|
| Geopolitical (war, strike, drone, attack) | same | inverse | inverse | inverse* | null |
| Monetary Easing (rate cut, dovish, pause) | same | same | same | same | inverse |
| Monetary Tightening (rate hike, hawkish) | same | same | same | same | inverse |
| Economic Strength (beat, strong data, jobs) | same | inverse | inverse | same | null |
| Economic Weakness (miss, recession, weak) | same | same | same | inverse | null |
| De-escalation (ceasefire, peace, truce) | same | inverse | inverse | inverse | null |
| Default (everything else) | same | null | null | null | null |

*Energy is `inverse` for geopolitical because supply disruption = bullish for oil when equities sell off.

Export a function:
```typescript
export function getInstrumentSentiment(
  equitySentiment: 'bullish' | 'bearish',
  eventCategory: string,   // from classifyRiskType or classifyEventType
  instrument: string        // user's selected instrument
): 'bullish' | 'bearish'
```

Logic: look up asset class from `ASSET_CLASS_MAP`, look up reaction from `EVENT_SENTIMENT_REACTIONS`, flip if `inverse`, pass through if `same` or `null`.

### 2. Wire Sentiment Flipper into Feed Handler
- **Path:** `backend-hono/src/routes/riskflow/handlers.ts`
- **Action:** Modify the per-request re-estimation block (lines 129-150)
- **Spec:**

Currently this block re-estimates point magnitude. Add sentiment flipping:
1. Import `getInstrumentSentiment` from iv-scoring-v2
2. For each item, determine the event category using `item.risk_type` or `item.tags`
3. Call `getInstrumentSentiment(item.sentiment, eventCategory, instrument)`
4. Set `priceBrainScore.sentiment` to the flipped value

### 3. Store Per-Instrument Scores in Supabase
- **Path:** `backend-hono/src/services/supabase-service.ts`
- **Action:** Modify `ScoredRiskFlowItem` type + add storage function
- **Spec:**

Add an `instrument_scores` JSONB column to `scored_riskflow_items`. Structure:
```json
{
  "/ES": { "sentiment": "bearish", "impliedPoints": 12.5 },
  "/GC": { "sentiment": "bullish", "impliedPoints": 6.6 }
}
```

- **Migration:** Create `supabase/migrations/20260329_instrument_scores.sql`:
  ```sql
  ALTER TABLE scored_riskflow_items
  ADD COLUMN IF NOT EXISTS instrument_scores JSONB DEFAULT '{}';

  CREATE INDEX IF NOT EXISTS idx_scored_instrument_scores
  ON scored_riskflow_items USING gin (instrument_scores);
  ```

- Add `instrument_scores` to the `ScoredRiskFlowItem` interface
- In the feed handler, after computing the per-instrument sentiment + points, merge the result into the item's `instrument_scores` and upsert back to Supabase (lazy population — only when a user requests that instrument)

### 4. Frontend: Replace ▲/▼ with ± Symbol
- **Path:** `frontend/components/feed/RiskFlowDetailCard.tsx`
- **Action:** Modify
- **Spec:**

Replace all instances of:
```tsx
{isBull ? '▲ BULLISH' : '▼ BEARISH'}
```
With:
```tsx
{isBull ? '+ BULLISH' : '- BEARISH'}
```
Or better — use `±` for implied points display:
```tsx
// Direction label (keep text, change icon)
<span>{'±'} {isBull ? 'BULLISH' : 'BEARISH'}</span>

// Points display (change ▲/▼ to ±)
<span>±{Math.abs(pts).toFixed(0)} pts</span>
```

The ± should be colored: bullish = green, bearish = red. The word BULLISH/BEARISH stays. Only the arrow icon changes.

### 5. Frontend: Replace ▲/▼ in RiskFlowMini
- **Path:** `frontend/components/RiskFlowMini.tsx`
- **Action:** Modify
- **Spec:**

Same changes as #4 in these locations:
- `DirectionBadge` component (line 92-99): `▲`/`▼` → `±`
- AlertRow footer (line 417-418): `▲ BULLISH`/`▼ BEARISH` → `± BULLISH`/`± BEARISH`
- Deviation indicators (line 452-454): `▲`/`▼` → `±`

### 6. Frontend: Make `inferDirection()` Instrument-Aware
- **Path:** `frontend/lib/riskflow-feed.ts`
- **Action:** Modify `inferDirection()`
- **Spec:**

The backend now returns the correct per-instrument sentiment in `priceBrainScore.sentiment`. So `inferDirection()` should prefer `alert.direction` (which comes from `priceBrainScore.sentiment`) over keyword inference. This already works — the function checks `alert.direction` first (line 187). No code change needed IF the backend correctly sets `direction` in the frontend mapping.

Check `frontend/contexts/RiskFlowContext.tsx` line 193:
```typescript
direction: item.priceBrainScore?.sentiment ?? null,
```
This already reads from `priceBrainScore.sentiment` — so the backend flipping will flow through automatically.

### 7. Update CatalystCard ± Symbol
- **Path:** `frontend/components/narrative/CatalystCard.tsx`
- **Action:** Modify
- **Spec:**

Replace `▲`/`▼` in the direction bias indicator (recently added S9-T2 deviation section) with `±`:
```tsx
{catalyst.directionBias === 'bullish' ? '+' : '-'}
```

---

## Key Rules
- `/ES` and `/NQ` scoring MUST NOT change — backward compatible
- The sentiment flip only applies at serve-time (feed handler), not during enrichment
- `enforceSentiment()` runs BEFORE the instrument flip — it sets the equity-centric sentiment, then the flipper converts for the target instrument
- Only populate `instrument_scores` JSONB lazily — when a user actually requests that instrument
- The `classifyRiskType()` output in `central-scorer.ts` (Macro/Geopolitical/Earnings/etc.) is the primary event category for the flipper. If `risk_type` is null, fall through to `classifyEventType()` from `iv-scoring-v2.ts`
- Use existing `INSTRUMENT_BETAS` for asset class lookup — don't duplicate the instrument list

## DO NOT
- Re-enrich or re-score all 640+ items in the database
- Add per-instrument scoring to the central-scorer polling loop (that stays /ES-centric)
- Modify `enrichWithAnalysis()` in feed-service.ts
- Touch NarrativeForceCanvas, chat interfaces, or dashboard layout
- Add new API endpoints — the existing feed endpoint handles this
- Use the word "Neutral" for sentiment — always force bullish or bearish (conservative = bearish)

## Verification
```bash
# 1. Build passes
cd frontend && npx vite build

# 2. Backend compiles
cd backend-hono && npx tsc --noEmit

# 3. No ▲ or ▼ in direction displays
grep -rn '▲\|▼' frontend/components/feed/RiskFlowDetailCard.tsx frontend/components/RiskFlowMini.tsx frontend/components/narrative/CatalystCard.tsx
# Should return 0 results

# 4. Instrument sentiment flipper works
# Start backend: cd backend-hono && bun run dev
# Test /ES (default):
curl -s 'localhost:8080/api/riskflow/feed?instrument=/ES' | python3 -c "import sys,json; items=json.load(sys.stdin).get('items',[]); [print(f'{i[\"headline\"][:60]}... → {i.get(\"priceBrainScore\",{}).get(\"sentiment\")}') for i in items[:5]]"

# Test /GC (gold — geopolitical headlines should flip to Bullish):
curl -s 'localhost:8080/api/riskflow/feed?instrument=/GC' | python3 -c "import sys,json; items=json.load(sys.stdin).get('items',[]); [print(f'{i[\"headline\"][:60]}... → {i.get(\"priceBrainScore\",{}).get(\"sentiment\")}') for i in items[:5]]"
```

## Changelog Entry
```typescript
{
  date: '2026-03-29T12:00:00',
  agent: 'claude-code',
  summary: 'S9-T2b: Instrument-aware sentiment (asset class flipper), per-instrument Supabase storage, ± symbol replaces ▲/▼ arrows',
  files: [
    'backend-hono/src/services/iv-scoring-v2.ts',
    'backend-hono/src/routes/riskflow/handlers.ts',
    'backend-hono/src/services/supabase-service.ts',
    'supabase/migrations/20260329_instrument_scores.sql',
    'frontend/components/feed/RiskFlowDetailCard.tsx',
    'frontend/components/RiskFlowMini.tsx',
    'frontend/components/narrative/CatalystCard.tsx',
    'frontend/lib/riskflow-feed.ts',
  ]
}
```
