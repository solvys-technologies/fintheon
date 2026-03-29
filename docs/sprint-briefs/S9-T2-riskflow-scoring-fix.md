# S9-T2: RiskFlow Feed Fix + IV Scoring Refactor + Deviation Indicators

**Sprint**: S9 — Fix Everything Right
**Track**: T2 (after T1 completes)
**Branch**: `v.8.28.1`

## Context
RiskFlow feed shows barely any items despite 640+ in the backend DB. The 24h stalemate filter and localStorage dismissedIds are killing items. IV scoring produces nonsensical results (Trump bombing headline scored bullish at 110 implied points). Deviation indicators (beat/miss/inline) don't appear anywhere. The Refinement Engine is missing its default Persons of Interest. All of this must be fixed.

**IMPORTANT**: T1 renamed components. Use NEW names:
- `RiskFlowPanel` → `RiskFlowMini` (file: `RiskFlowMini.tsx`)
- `NewsSection` → `RiskFlowMain` (file: `feed/RiskFlowMain.tsx`)
- `NarrativeFlow` → `NarrativeMap`

## Design Direction
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- Deviation badges: Green BEAT / Red MISS / Amber INLINE — same style as SanctumEconIntel
- IV score: monospace number, subtle
- Implied points: direction arrow + points value

---

## FILES TO READ FIRST
- `frontend/contexts/RiskFlowContext.tsx` (398 lines) — feed polling, 24h filter, dismissedIds
- `frontend/lib/riskflow-feed.ts` — RiskFlowAlert type, ensureScoring, inferDirection
- `backend-hono/src/services/iv-scoring-v2.ts` — IV scoring with implied points
- `backend-hono/src/services/market-data/point-estimator.ts` — VIX × beta × multiplier formula
- `backend-hono/src/services/riskflow/feed-service.ts` — MAX_FEED_ITEMS, caching
- `backend-hono/src/services/riskflow/central-scorer.ts` — scoring pipeline
- `frontend/components/refinement/RefinementEngine.tsx` — Persons of Interest listing
- `frontend/components/narrative/SanctumEconIntel.tsx` — beat/miss/inline badge reference implementation
- `backend-hono/src/types/commentator.ts` — commentator (now Persons of Interest) type definitions

---

## FIXES

### 1. Kill 24h Stalemate Filter (frontend/contexts/RiskFlowContext.tsx)
Find and DELETE:
```typescript
const STALE_CUTOFF_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const isFresh = (a: RiskFlowAlert) => {
    if (!a.publishedAt) return true;
    return now - new Date(a.publishedAt).getTime() < STALE_CUTOFF_MS;
};
```
And remove `.filter(isFresh)` from the merged alerts pipeline.

Items persist FOREVER. The whole point of the backfill was to keep historical data.

### 2. Kill DismissedIds (frontend/contexts/RiskFlowContext.tsx)
Remove the entire dismissedIds system:
- Delete `DISMISSED_STORAGE_KEY` constant
- Delete `dismissedIds` state and its `loadStoredIds` call
- Delete `persistIds(DISMISSED_STORAGE_KEY, ...)` effect
- Delete `.filter((a) => !dismissedIds.has(a.id))` from visibleAlerts
- Remove `clearAll` function (or make it a no-op)
- Remove `removeAlert` function (or make it a no-op)
- Keep `seenIds` — that's for visual "new" indicator, not deletion

### 3. Bump Feed Init to 50 (frontend/contexts/RiskFlowContext.tsx)
Change `limit: 30` → `limit: 50` in `pollBackendFeed()`.
Also bump `MAX_FEED_ITEMS` in `backend-hono/src/services/riskflow/feed-service.ts` from 50 to 100 (backend should return more than frontend asks for).

### 4. IV Scoring Martingale Refactor (backend-hono/src/services/iv-scoring-v2.ts)

**Current problem**: Every critical headline gets the same full implied points score. 3 headlines in a row all score 110 points — nonsensical.

**New logic — Diminishing Returns (Martingale-like)**:
```typescript
// Track session headline count by severity tier
// Session = rolling 4-hour window (trading session)
const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

function getSessionMultiplier(sessionCriticalCount: number): number {
  // 1st critical headline of session: 100% of calculated points
  // 2nd: 60%
  // 3rd+: 30% (diminishing returns — market already priced it in)
  if (sessionCriticalCount <= 1) return 1.0;
  if (sessionCriticalCount === 2) return 0.6;
  return 0.3;
}
```

**Geopolitical Escalation Override**:
```typescript
// If headline chain shows ESCALATION (military action, retaliation, strikes, invasion)
// bypass Martingale — full weight regardless of session count
const ESCALATION_KEYWORDS = ['military', 'strike', 'bomb', 'invasion', 'retaliate', 'mobilize', 'deploy', 'attack', 'offensive', 'missile', 'nuclear', 'blockade'];

function isEscalation(headline: string): boolean {
  const lower = headline.toLowerCase();
  return ESCALATION_KEYWORDS.some(kw => lower.includes(kw));
}
```

**Sentiment Fix**:
- "Bombing water facilities" MUST score as bearish, not bullish
- Check the Grok analyzer's sentiment classification
- If headline contains destruction/violence/sanctions → force bearish unless explicitly market-positive
- In `backend-hono/src/services/analysis/grok-analyzer.ts` or `iv-scoring-v2.ts`, add override:
```typescript
const FORCED_BEARISH_KEYWORDS = ['bomb', 'attack', 'strike', 'sanction', 'destroy', 'crash', 'collapse', 'default', 'shutdown', 'war'];
if (FORCED_BEARISH_KEYWORDS.some(kw => headline.toLowerCase().includes(kw))) {
  sentiment = 'Bearish';
}
```

**Implied Points Display Change**:
The implied points should show how much the headline INCREASES the session's implied volatility BY, not the absolute updated value. In the point-estimator:
- Store session baseline at start
- Each new headline shows `+X pts` or `-X pts` relative to baseline
- This makes noisy headlines obvious ("+2 pts" vs the nonsensical "110 pts")

### 5. Add Deviation Indicators (3 locations)

**Where to add**: Expanded RiskFlowMain items, CatalystCard expanded view, Expanded RiskFlowMini cards. NOWHERE ELSE.

**What to show** (same pattern as SanctumEconIntel):
```tsx
{/* Beat/Miss/Inline badge */}
{alert.econData?.beatMiss && (
  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
    alert.econData.beatMiss === 'beat' ? 'bg-emerald-500/15 text-emerald-400' :
    alert.econData.beatMiss === 'miss' ? 'bg-red-500/15 text-red-400' :
    'bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]'
  }`}>
    {alert.econData.beatMiss.toUpperCase()}
  </span>
)}

{/* IV Score */}
{alert.ivScore != null && (
  <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/60">
    IV {alert.ivScore.toFixed(1)}
  </span>
)}

{/* Implied Points — relative to session baseline */}
{alert.pointRange != null && alert.pointRange !== 0 && (
  <span className={`text-[9px] font-mono font-bold ${
    alert.direction === 'Bullish' ? 'text-[var(--fintheon-bullish)]' : 'text-[var(--fintheon-bearish)]'
  }`}>
    {alert.direction === 'Bullish' ? '▲' : '▼'} +{Math.abs(alert.pointRange).toFixed(0)} pts
  </span>
)}
```

**Files to add indicators to**:
1. `frontend/components/feed/RiskFlowMain.tsx` (renamed from NewsSection) — in the expanded card area
2. `frontend/components/narrative/CatalystCard.tsx` — in the card body
3. `frontend/components/RiskFlowMini.tsx` (renamed from RiskFlowPanel) — in the expanded alert row area

### 6. Persons of Interest Defaults in Refinement Engine

Read `frontend/components/refinement/RefinementEngine.tsx`. Find where "commentators" are listed and ensure these 8 Persons of Interest are the defaults:

| Name | Role | Weight |
|------|------|--------|
| Fed Chair (Powell) | Central banker, data-dependent | 1.0 |
| Trump | Executive, tariff hawk | 1.0 |
| Bessent | Treasury Secretary | 1.0 |
| Rubio | Foreign policy senator | 0.8 |
| Lutnick | Commerce Secretary | 0.8 |
| Witkoff | Middle East envoy | 0.7 |
| Greer | US Trade Rep | 0.8 |
| Navarro | Trade advisor, protectionist | 0.7 |

Rename all "Commentator" labels to "Person of Interest" or "POI" in the UI.

### 7. Find and Wire Firecrawl
```bash
grep -rn "firecrawl\|Firecrawl" backend-hono/ --include="*.ts"
```
If it exists: make sure it feeds into `raw_riskflow_items` table for the central scorer to pick up.
If it doesn't exist: check `backend-hono/scripts/scrape-posts.ts` — that might be the scraper. Wire its output to the scoring pipeline.

---

## VERIFICATION
```bash
# 1. Build passes
npx vite build

# 2. No stalemate filter
grep -n "STALE_CUTOFF\|isFresh\|dismissedIds\|DISMISSED_STORAGE" frontend/contexts/RiskFlowContext.tsx
# Should return 0 results

# 3. Feed limit is 50
grep -n "limit: 50" frontend/contexts/RiskFlowContext.tsx

# 4. Start backend and check item count
cd backend-hono && bun run dev &
sleep 3
curl -s localhost:8080/api/riskflow/feed?limit=50 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Items: {len(d.get(\"items\",[]))}')"
```

## Changelog Entry
```typescript
{ date: '2026-03-30T00:00:00', agent: 'claude-code', summary: 'S9-T2: Kill 24h filter + dismissedIds, bump feed to 50, IV Martingale diminishing returns, sentiment fix, deviation indicators in 3 locations, Persons of Interest defaults', files: ['frontend/contexts/RiskFlowContext.tsx', 'backend-hono/src/services/iv-scoring-v2.ts', 'backend-hono/src/services/market-data/point-estimator.ts', 'frontend/components/feed/RiskFlowMain.tsx', 'frontend/components/narrative/CatalystCard.tsx', 'frontend/components/RiskFlowMini.tsx', 'frontend/components/refinement/RefinementEngine.tsx'] }
```

## DO NOT
- Do NOT rename components (T1 handles that)
- Do NOT modify NarrativeForceCanvas (T3 owns that)
- Do NOT modify chat interfaces (T4 owns that)
- Do NOT touch the dashboard layout (T3 owns that)
- Do NOT cap implied points with a hard maximum — fix the root cause
- Do NOT add deviation indicators anywhere except the 3 specified locations
