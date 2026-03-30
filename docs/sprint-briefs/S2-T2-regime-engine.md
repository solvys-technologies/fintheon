# S2-T2: Regime Engine + MDB Integration

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T2 (Wave 2 — parallel with T3, T4 after T1 completes)
**Depends on:** T1 (types in `backend-hono/src/types/regime.ts`)

---

## Objective

Build the backend regime classification engine: a service that stores/retrieves the current market regime, a detector that proposes regime changes from news flow patterns, MDB integration that sets the regime during morning brief generation, and CRUD endpoints for manual override.

---

## Files to Read First

- `backend-hono/src/types/regime.ts` — MarketRegime type, RegimeState, DEFAULT_REGIME_MULTIPLIERS (created by T1)
- `backend-hono/src/services/brief-generator.ts` — MDB generation pipeline, prompt template, data sources
- `backend-hono/src/services/supabase-service.ts` — existing table patterns, read/write conventions
- `backend-hono/src/services/riskflow/feed-service.ts` — how feed items are aggregated (regime detector reads from this)
- `backend-hono/src/routes/index.ts` — route registration pattern
- `backend-hono/src/config/regime-multipliers.json` — default regime config (created by T1)

---

## Files to Create

### 1. `backend-hono/src/services/regime/regime-service.ts` (NEW, ~120 lines)

Core regime state management:

```typescript
import type { MarketRegime, RegimeState } from '../../types/regime';

// In-memory cache of current regime (refreshed from Supabase on read)
let currentRegime: RegimeState | null = null;

export async function getCurrentRegime(): Promise<RegimeState>
// Returns active regime from Supabase. Falls back to CONSOLIDATION if none set.
// Caches in memory with 60s TTL.

export async function setRegime(
  regime: MarketRegime,
  detectedBy: 'mdb_agent' | 'manual' | 'regime_detector',
  confidence: number,
  notes?: string
): Promise<RegimeState>
// Deactivates previous active regime, inserts new one, returns it.
// Clears in-memory cache.

export async function getRegimeHistory(limit?: number): Promise<RegimeState[]>
// Returns recent regime changes ordered by createdAt DESC.

export function getRegimeMultipliers(regime: MarketRegime): RegimeMultiplierProfile
// Returns the multiplier profile for a given regime from DEFAULT_REGIME_MULTIPLIERS.
// Later: reads overrides from scoring_calibration table.
```

### 2. `backend-hono/src/services/regime/regime-detector.ts` (NEW, ~150 lines)

Proposes regime changes based on news flow patterns:

```typescript
import type { MarketRegime } from '../../types/regime';
import type { FeedItem } from '../../types/riskflow';

interface RegimeSignal {
  proposedRegime: MarketRegime;
  confidence: number;     // 0-1
  reasoning: string[];    // why this regime was detected
  triggerItems: string[]; // item IDs that triggered the detection
}

export function detectRegimeFromFeed(
  items: FeedItem[],
  windowHours: number = 6
): RegimeSignal | null
// Analyzes recent items within windowHours and proposes a regime:
//
// Detection heuristics:
// - GEO_TENSIONS: 3+ geopolitical/tariff/conflict items in window with macroLevel >= 3
// - MACRO_ECON: 3+ fed/cpi/nfp/gdp items in window with macroLevel >= 3
// - EARNINGS_SEASON: 5+ earnings items in window (calendar-aware: Jan/Apr/Jul/Oct)
// - RISK_OFF: VIX > 25 AND 2+ items with bearish sentiment and macroLevel >= 3
// - ILLIQUID_STUPIDITY: Any liquidityStress/bankStress item with macroLevel 4
// - BULL_TREND / BEAR_TREND / CONSOLIDATION: These require broader market data
//   (price action, moving averages). For V1, these are manual-set only.
//   Return null and let MDB or manual override handle it.
//
// Returns highest-confidence signal, or null if no strong signal.

export function shouldProposRegimeChange(
  current: MarketRegime,
  signal: RegimeSignal
): boolean
// Only propose if: signal confidence > 0.6 AND proposed !== current.
// Prevents flip-flopping on weak signals.
```

### 3. `backend-hono/src/routes/regime/index.ts` (NEW, ~15 lines)
Route registration file.

### 4. `backend-hono/src/routes/regime/handlers.ts` (NEW, ~100 lines)

```typescript
// GET /api/regime/current — returns current active regime
// GET /api/regime/history?limit=20 — returns regime change history
// POST /api/regime/set — manual override { regime, notes }
// POST /api/regime/detect — triggers detection from current feed, returns signal (does NOT auto-apply)
```

---

## Files to Modify

### 1. `backend-hono/src/services/supabase-service.ts`

Add functions for `market_regimes` table:

```typescript
// Add to existing file:
export async function writeRegimeState(state: Omit<RegimeState, 'id' | 'createdAt'>): Promise<void>
// INSERT into market_regimes

export async function readActiveRegime(): Promise<RegimeState | null>
// SELECT from market_regimes WHERE active = true ORDER BY created_at DESC LIMIT 1

export async function deactivateCurrentRegime(): Promise<void>
// UPDATE market_regimes SET active = false WHERE active = true

export async function readRegimeHistory(limit: number = 20): Promise<RegimeState[]>
// SELECT from market_regimes ORDER BY created_at DESC LIMIT $limit
```

**Table creation:** Add to an init function or create inline:
```sql
CREATE TABLE IF NOT EXISTS market_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_type TEXT NOT NULL,
  detected_by TEXT NOT NULL,
  confidence DECIMAL(3,2),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regime_active ON market_regimes(active) WHERE active = true;
```

### 2. `backend-hono/src/services/brief-generator.ts`

**Modify the MDB prompt template** to include regime classification output:

Add to the MDB prompt (around line 100-123):
```
**Market Regime:** [BULL_TREND | BEAR_TREND | CONSOLIDATION | GEO_TENSIONS | MACRO_ECON | RISK_OFF | EARNINGS_SEASON | ILLIQUID_STUPIDITY]
One-line justification for regime classification.
```

**After brief generation**, parse the regime from the AI response and auto-set it:
```typescript
// After generating the brief text:
const regimeMatch = briefText.match(/\*\*Market Regime:\*\*\s*(\w+)/);
if (regimeMatch) {
  const detectedRegime = regimeMatch[1] as MarketRegime;
  if (MARKET_REGIMES.includes(detectedRegime)) {
    await setRegime(detectedRegime, 'mdb_agent', 0.8, 'Auto-detected from MDB');
  }
}
```

### 3. `backend-hono/src/routes/index.ts`

Add regime routes:
```typescript
import regimeRoutes from './regime';
app.route('/api/regime', regimeRoutes);
```

---

## Key Rules / Corrections

- **Regime detection is PROPOSAL only** — the `/api/regime/detect` endpoint returns a signal but does NOT auto-apply. Only MDB auto-applies (with confidence 0.8). Manual override always applies immediately.
- **BULL_TREND, BEAR_TREND, CONSOLIDATION** are manual-only in V1 — these require price action context the news feed doesn't have. The detector only proposes GEO_TENSIONS, MACRO_ECON, EARNINGS_SEASON, RISK_OFF, ILLIQUID_STUPIDITY.
- **Default regime is CONSOLIDATION** — if no regime has been set, assume Consolidation (most neutral).
- **MDB regime detection** happens AFTER brief text is generated — parse it from the AI response, don't try to detect before generating.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Regime CRUD works
curl -X POST http://localhost:8080/api/regime/set \
  -H "Content-Type: application/json" \
  -d '{"regime": "BEAR_TREND", "notes": "Manual test"}'

curl http://localhost:8080/api/regime/current
# Should return: { "regime": "BEAR_TREND", "detectedBy": "manual", ... }

curl http://localhost:8080/api/regime/history?limit=5

# 3. Detect endpoint returns signal without applying
curl -X POST http://localhost:8080/api/regime/detect
# Should return: { "proposedRegime": "...", "confidence": ..., "reasoning": [...] } or null
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T2: Regime engine — service, detector, CRUD routes, MDB integration for auto-regime detection', files: ['backend-hono/src/services/regime/regime-service.ts', 'backend-hono/src/services/regime/regime-detector.ts', 'backend-hono/src/routes/regime/handlers.ts', 'backend-hono/src/services/brief-generator.ts', 'backend-hono/src/services/supabase-service.ts'] }
```

---

## DO NOT

- Do NOT modify the IV scoring engine (T5 scope)
- Do NOT create frontend components (T6/T7 scope)
- Do NOT modify the commentator system (T3 scope)
- Do NOT modify the calibration tables (T4 scope)
- Do NOT auto-apply regime on detect endpoint — proposal only
- Do NOT try to detect BULL/BEAR/CONSOLIDATION from news flow — manual only in V1
