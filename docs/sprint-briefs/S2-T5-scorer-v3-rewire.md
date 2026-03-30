# S2-T5: IV Scorer V3 — Regime-Aware Rewire

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T5 (Wave 3 — after T2, T3, T4 complete)
**Depends on:** T1 (types), T2 (regime engine), T3 (commentator service), T4 (calibration service)

---

## Objective

Rewire the IV scoring engine to be regime-aware. The scorer currently applies static EVENT_WEIGHTS regardless of market context. After this track, every scored item flows through: (1) dynamic base weight from calibration table, (2) regime multiplier based on current market regime + item sentiment, (3) commentator tier multiplier based on extracted speaker, and (4) a re-score endpoint that re-processes current feed items with updated weights.

**Also includes bug fixes from previously unshipped sprint:**
- Block "breaking" boost on scheduled data releases (CPI/NFP/GDP/etc should never get +1.5 breaking boost — they're scheduled, not breaking)
- Reduce ISM/PMI base weight from 7→5 in scoring-weights.json (same tier as CPI was wrong)
- Add narrativePressure (0-3) to ParsedHeadline — measures "pressure valve release" intensity for springboard events (ceasefire, Fed pivot, trade deal = 3 = 300+ pt moves)
- Cap estimatePoints by narrativePressure (routine events claim max 25% of daily range, pressure valve releases claim up to 45%)
- Fix frontend GEOPOLITICAL_TERMS list so geo headlines don't get wrongly downgraded to LOW
- Fix instrument propagation — always use user's selected instrument, not stale /ES

---

## Files to Read First

**CRITICAL — read these thoroughly before writing any code:**

- `backend-hono/src/services/analysis/iv-scorer.ts` — THE scoring engine. Lines 111-276 are the core scoring function. Lines 227-230 are the tier ceiling. Lines 291+ are score-to-points.
- `backend-hono/src/services/iv-scoring-v2.ts` — EVENT_WEIGHTS map (~line 30), continuousVIXMultiplier (~line 356), classifyEventType (~line 954)
- `backend-hono/src/services/riskflow/central-scorer.ts` — batch scoring pipeline that calls the scorer
- `backend-hono/src/services/riskflow/feed-service.ts` — enrichFeedWithAnalysis(), getFeed()
- `backend-hono/src/types/regime.ts` — MarketRegime, DEFAULT_REGIME_MULTIPLIERS
- `backend-hono/src/types/commentator.ts` — TIER_DEFAULT_MULTIPLIERS, UNTAGGED_MULTIPLIER
- `backend-hono/src/types/calibration.ts` — CalibrationEntry
- `backend-hono/src/services/regime/regime-service.ts` — getCurrentRegime(), getRegimeMultipliers() (T2)
- `backend-hono/src/services/commentator/commentator-service.ts` — getMultiplierForSpeaker() (T3)
- `backend-hono/src/services/calibration/calibration-service.ts` — getWeightForEvent() (T4)
- `backend-hono/src/types/news-analysis.ts` — ParsedHeadline (now has speaker field from T3)

---

## Files to Modify

### 1. `backend-hono/src/services/analysis/iv-scorer.ts` — MAIN CHANGE

**Current scoring flow (lines 111-276):**
```
baseEventWeight = EVENT_WEIGHTS[eventType]
+ breaking boost
× urgency multiplier
+ market reaction boost
+ magnitude boost
+ deviation boost
+ hot print boost
× timing window
× VIX multiplier
= clamped to tier ceiling (baseWeight + 4, max 10)
```

**New V3 scoring flow:**
```
dynamicBaseWeight = await getWeightForEvent(eventType)  // from calibration table, NOT hardcoded
+ breaking boost
× urgency multiplier
+ market reaction boost
+ magnitude boost
+ deviation boost
+ hot print boost
× timing window
× VIX multiplier
× regimeMultiplier                                       // NEW: from current regime × event type
× commentatorMultiplier                                  // NEW: from speaker tier
= clamped to tier ceiling (dynamicBaseWeight + 4, max 10)
```

**Specific changes:**

1. **Import new services:**
```typescript
import { getCurrentRegime, getRegimeMultipliers } from '../regime/regime-service';
import { getMultiplierForSpeaker } from '../commentator/commentator-service';
import { getWeightForEvent } from '../calibration/calibration-service';
```

2. **Replace hardcoded EVENT_WEIGHTS lookup:**
```typescript
// BEFORE:
const baseEventWeight = EVENT_WEIGHTS[eventType] ?? EVENT_WEIGHTS.default;

// AFTER:
const baseEventWeight = await getWeightForEvent(eventType);
```
Note: This makes the function async if it wasn't already. Check and update signature.

3. **Add regime multiplier (after VIX multiplier, before tier ceiling):**
```typescript
// Get current regime
const regimeState = await getCurrentRegime();
const regimeProfile = getRegimeMultipliers(regimeState.regime);

// Determine regime multiplier for this item
let regimeMultiplier = 1.0;
// First check event-type-specific override
if (regimeProfile.eventTypeOverrides[eventType]) {
  regimeMultiplier = regimeProfile.eventTypeOverrides[eventType];
}
// Then apply sentiment-based scaling
const sentiment = inferSentiment(parsed, hotPrint); // existing function
if (sentiment === 'bullish') {
  regimeMultiplier *= regimeProfile.sentimentMultipliers.bullish;
} else if (sentiment === 'bearish') {
  regimeMultiplier *= regimeProfile.sentimentMultipliers.bearish;
} else {
  regimeMultiplier *= regimeProfile.sentimentMultipliers.neutral;
}

score *= regimeMultiplier;
```

4. **Add commentator multiplier (after regime, before tier ceiling):**
```typescript
// Get speaker multiplier
let commentatorMultiplier = 1.0;
if (parsed.speaker) {
  commentatorMultiplier = await getMultiplierForSpeaker(parsed.speaker);
}
score *= commentatorMultiplier;
```

5. **Update tier ceiling to use dynamic base weight:**
```typescript
// BEFORE:
const maxBoostedScore = Math.min(10, baseEventWeight + 4);

// AFTER (same logic, but baseEventWeight is now dynamic):
const maxBoostedScore = Math.min(10, baseEventWeight + 4);
// No change needed — variable name is the same, value comes from calibration table
```

6. **Add regime + commentator to subScores output:**
```typescript
// Add to SubScoreBreakdown return:
subScores: {
  ...existing,
  regimeMultiplier,     // NEW
  regimeName: regimeState.regime,  // NEW
  commentatorMultiplier, // NEW
  speaker: parsed.speaker || null, // NEW
}
```

7. **Add regime + commentator to rationale:**
```typescript
rationale.push(`Regime: ${regimeState.regime} (${regimeMultiplier.toFixed(2)}x)`);
if (parsed.speaker) {
  rationale.push(`Speaker: ${parsed.speaker} (${commentatorMultiplier.toFixed(2)}x tier)`);
}
```

### 2. `backend-hono/src/types/riskflow.ts`

Update SubScoreBreakdown to include new fields:
```typescript
// Add to SubScoreBreakdown interface:
regimeMultiplier?: number;
regimeName?: string;
commentatorMultiplier?: number;
speaker?: string | null;
```

### 3. `backend-hono/src/services/riskflow/central-scorer.ts`

The central scorer calls enrichFeedWithAnalysis which calls calculateIVScore. If the scoring function signature changed (became async or needs new params), update the call site.

**Key check:** Ensure the central scorer passes regime context through. It should "just work" if the scorer fetches regime internally, but verify the data flows.

### 4. `backend-hono/src/routes/riskflow/handlers.ts` — Add re-score endpoint

Create a new handler:
```typescript
// POST /api/riskflow/rescore
// Re-processes current cached feed items with current weights/regime.
// Returns: { rescored: number, items: FeedItem[] }
export async function handleRescore(c: Context) {
  // 1. Get current feed items from cache
  // 2. For each item, re-run calculateIVScore with current regime + calibration weights
  // 3. Update in-memory cache with new scores
  // 4. Return rescored items
}
```

Register in riskflow routes.

---

## Additional Bug Fixes (from unshipped sprint)

### 5. `backend-hono/src/services/analysis/iv-scorer.ts` — Block breaking boost on scheduled data

Around the breaking news section (~line 126), add:
```typescript
const SCHEDULED_DATA_EVENTS = ['cpiPrint', 'ppiPrint', 'nfpPrint', 'gdpPrint', 'pcePrint', 'ismPrint', 'ism', 'jolts', 'retailSales', 'housing', 'jobless', 'economicData'];
if (parsed.isBreaking && !SCHEDULED_DATA_EVENTS.includes(eventType)) {
  score += 1.5;
  subMomentum += 0.75;
  rationale.push('Breaking headline: +1.5');
}
```

### 6. `backend-hono/src/config/scoring-weights.json` — Reduce ISM/PMI weights

```json
"ismPrint": 5,   // was 7 — PMI/ISM is mid-tier, not same as CPI/NFP
"ism": 5,        // was 7
"economicData": 4 // was 5
```

### 7. `backend-hono/src/types/news-analysis.ts` — Add narrativePressure to ParsedHeadline

```typescript
// Add to ParsedHeadline interface:
narrativePressure?: 0 | 1 | 2 | 3;
// 0=routine, 1=notable, 2=resolves significant uncertainty, 3=massive pressure valve release
```

### 8. `backend-hono/src/services/market-data/point-estimator.ts` — Cap by narrativePressure

Add narrativePressure param to estimatePoints():
```typescript
export function estimatePoints(
  ivScore: number, vixLevel: number, instrument: string = '/ES',
  currentPrice?: number, narrativePressure: number = 0,
): PointEstimate {
  // ... existing implied points calc ...

  // Cap based on narrative pressure (% of daily range a single event can claim)
  const CAP_BY_NARRATIVE: Record<number, number> = { 0: 0.25, 1: 0.30, 2: 0.35, 3: 0.45 };
  const cap = CAP_BY_NARRATIVE[Math.min(3, Math.max(0, narrativePressure))] ?? 0.25;
  const maxPoints = implied.adjustedPoints * cap;
  const scaleFactor = Math.min(1, ivScore / 10);
  const rawScaled = implied.adjustedPoints * scaleFactor;
  const scaledPoints = Number(Math.min(maxPoints, rawScaled).toFixed(1));
}
```

### 9. `frontend/lib/riskflow-feed.ts` — Add GEOPOLITICAL_TERMS + fix instrument

**a) Add GEOPOLITICAL_TERMS list** after FINANCIAL_TERMS:
```typescript
const GEOPOLITICAL_TERMS = [
  'iran', 'israel', 'russia', 'ukraine', 'china', 'taiwan',
  'war', 'ceasefire', 'sanctions', 'strike', 'missile', 'nato',
  'military', 'troops', 'invasion', 'nuclear', 'embargo', 'blockade',
  'strait', 'hormuz', 'conflict', 'escalation', 'peace', 'treaty',
  'north korea', 'houthi', 'hezbollah', 'hamas', 'attack', 'drone',
];
```

**b) Update downgradeNonFinancialBreaking()** to check both lists:
```typescript
const hasFinancialTerm = FINANCIAL_TERMS.some((term) => wordMatch(lower, term) || lower.includes(term));
const hasGeopoliticalTerm = GEOPOLITICAL_TERMS.some((term) => lower.includes(term));
if (!hasFinancialTerm && !hasGeopoliticalTerm) {
  alert.severity = 'low';
}
```

**c) Force instrument override in ensureScoring()**:
```typescript
// OLD: if (!alert.instrument && selectedInstrument) { alert.instrument = selectedInstrument; }
// NEW:
if (selectedInstrument) { alert.instrument = selectedInstrument; }
```

### 10. `frontend/contexts/RiskFlowContext.tsx` — Force instrument in backend mapping

In the backend feed mapping (~line 167-186):
```typescript
// OLD: instrument: item.priceBrainScore?.instrument ?? null,
// NEW:
instrument: selectedSymbol.symbol,
```

---

## Files NOT to Modify (beyond the additions above)

- `iv-scoring-v2.ts` — keep EVENT_WEIGHTS as fallback, but scorer reads from calibration table first
- `feed-service.ts` — no changes needed, it calls the scorer which is now regime-aware

---

## Key Rules / Corrections

- **The scoring function may need to become async** to fetch from calibration table + regime service. If it's currently sync, convert to async and update all callers.
- **Performance:** getWeightForEvent() and getCurrentRegime() both cache in memory with TTL. Don't worry about DB calls per headline — they'll hit cache 99% of the time.
- **Regime multiplier is applied AFTER VIX multiplier, BEFORE tier ceiling.** This means a low-tier event in the right regime CAN break through what was previously its ceiling. This is intentional — jobless claims in MACRO_ECON mode (1.5x) should score higher than jobless claims in GEO_TENSIONS mode (0.3x).
- **The tier ceiling still applies** but uses the DYNAMIC base weight, not the hardcoded one. If calibration table changes CPI from 7.5 to 8.0, the ceiling moves from 11.5 to 12.0 (capped at 10).
- **Sentiment inference for regime multiplier:** Use the existing sentiment logic already in the scorer. The regime just scales it.
- **Re-score endpoint does NOT persist to Supabase.** It re-scores in-memory cache only. The user sees updated scores immediately in the feed. Central scorer will use new weights on next batch automatically.
- **Fallback:** If regime service is down (Supabase unreachable), default to CONSOLIDATION (all multipliers ≈ 1.0). If calibration table is empty, fall back to EVENT_WEIGHTS from scoring-weights.json.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Set regime to BEAR_TREND and verify scoring changes
curl -X POST http://localhost:8080/api/regime/set \
  -H "Content-Type: application/json" \
  -d '{"regime": "BEAR_TREND", "notes": "Testing"}'

# 3. Re-score current feed
curl -X POST http://localhost:8080/api/riskflow/rescore
# Verify: bullish items should have higher scores now (3.0x in BEAR_TREND)

# 4. Check subScores include regime info
curl "http://localhost:8080/api/riskflow/feed?instrument=/ES"
# Verify: items have subScores.regimeMultiplier and subScores.regimeName

# 5. Switch to GEO_TENSIONS and re-score
curl -X POST http://localhost:8080/api/regime/set \
  -H "Content-Type: application/json" \
  -d '{"regime": "GEO_TENSIONS"}'
curl -X POST http://localhost:8080/api/riskflow/rescore
# Verify: econ data items (CPI, NFP) should score MUCH lower (0.3x), geo items higher (1.5x)

# 6. Build passes
bun run build
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T5: IV Scorer V3 — regime-aware scoring with dynamic calibration weights, commentator tier multipliers, and re-score endpoint', files: ['backend-hono/src/services/analysis/iv-scorer.ts', 'backend-hono/src/types/riskflow.ts', 'backend-hono/src/services/riskflow/central-scorer.ts', 'backend-hono/src/routes/riskflow/handlers.ts'] }
```

---

## DO NOT

- Do NOT create new frontend UI (T6/T7 scope)
- Do NOT modify the regime engine service (T2 scope)
- Do NOT modify the commentator registry (T3 scope)
- Do NOT modify the calibration table service (T4 scope)
- Do NOT remove EVENT_WEIGHTS from iv-scoring-v2.ts — keep as fallback
- Do NOT persist re-scored results to Supabase — in-memory only
- Do NOT change score-to-points mapping in point-estimator.ts
