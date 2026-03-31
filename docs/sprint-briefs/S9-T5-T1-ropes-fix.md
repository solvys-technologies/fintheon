# S9-T5 Track 1: Ropes Fix (URGENT)

**Sprint:** S9-T5 Sanctum Map Intelligence Overhaul
**Track:** T1 — Ropes Fix
**Priority:** SHIP TODAY
**Depends on:** Nothing — runs first

---

## Objective

Get hub-to-catalyst and cross-catalyst ropes visibly rendering on the Sanctum force-directed map. The rope engine code is correct. The issue is a data pipeline problem between the seed loader, store, and canvas.

---

## Files to Read First

Read these in order to understand the full pipeline:

1. `frontend/lib/narrative-rope-engine.ts` — `computeHubRopes()` and `computeRopeConnections()` functions
2. `frontend/lib/narrative-seed-loader.ts` — `loadSeedEvents()` and `importRiskFlowItems()`
3. `frontend/lib/narrative-store.ts` — `BULK_ADD_CATALYSTS` reducer action (line 158-162)
4. `frontend/components/narrative/NarrativeMap.tsx` — seed loading effect (lines 35-42) and RiskFlow import (lines 44-54)
5. `frontend/components/narrative/NarrativeForceCanvas.tsx` — `buildEdges()` (lines 413-487), `buildNodesForZoom()` (lines 340-410), `filteredCatalysts` (lines 519-530), and the useMemo/useEffect where edges are computed (lines 533-596)
6. `frontend/contexts/NarrativeContext.tsx` — context wrapper
7. `frontend/data/narrative-seed-events.json` — seed data (cards have tags AND narrative fields)
8. `frontend/index.css` — lines 440-457 for `rope-breathe` animation CSS

---

## Root Cause Analysis (Pre-Investigation)

The rope engine has two functions:

### 1. `computeHubRopes(cards)` — Hub-to-Catalyst Ropes
- Creates a rope from each card to its narrative hub: `card.id` → `group-{thread}`
- Requires `card.narrative` or `card.narrativeThreads[0]` to be set
- In `buildEdges()` line 453, `group-` is replaced with `hub-` so the target matches the hub node ID (`hub-{thread}`)
- **Potential failure**: Cards without `narrative` field produce zero hub ropes

### 2. `computeRopeConnections(cards, 200)` — Cross-Catalyst Ropes
- Finds pairs of cards that share tags
- Requires `card.tags` to be non-empty array
- MIN_STRENGTH threshold of 0.15 — weak tag overlap is filtered out
- **Potential failure**: Cards without tags produce zero cross ropes

### Known Data Gaps

**Seed events** (narrative-seed-events.json): HAVE both `tags` and `narrative` fields. Should produce ropes.

**RiskFlow imports** (`importRiskFlowItems()` in narrative-seed-loader.ts line 69-99):
- Sets `tags: a.tags ?? []` — MAY be empty if RiskFlow alerts lack tags
- **DOES NOT set `narrative` or `narrativeThreads`** — these fields are MISSING from the import mapping
- Result: RiskFlow-imported cards produce ZERO hub ropes

### Additional Failure Points to Check

1. **Position generation**: In `buildNodesForZoom()` line 399, cards without positions are skipped: `if (!pos) continue;`. If `runForceSimulation()` doesn't assign positions to all cards, they won't become nodes, and ropes referencing them are filtered out by the `nodeIds` check.

2. **Seed flag**: `SEED_FLAG = 'fintheon:narrative-seeded:v8'` — seeds only load once. If the user's browser has this flag set but the store was cleared, cards are gone but the flag persists. The user would need to clear `fintheon:narrative-seeded:v8` from localStorage to re-seed.

3. **Store loading**: `loadNarrativeState()` loads from `localStorage.getItem('fintheon:narrative:v1')`. If this key has stale data (cards from before tags/narrative were added to the schema), stored cards may lack tags/narrative fields.

4. **Force simulation**: `buildSimData()` creates `SimNode` entries. If cards aren't getting into simNodes, they won't get positions. Check that every card in `filteredCatalysts` maps to a simNode.

---

## Debug Steps (Execute in Order)

### Step 1: Check what's in the store

Add a temporary `console.log` at the top of the `NarrativeFlowCanvas` component (NarrativeForceCanvas.tsx ~line 500, inside the function body):

```typescript
console.log('[ROPES DEBUG] catalysts in store:', state.catalysts.length);
console.log('[ROPES DEBUG] sample card:', JSON.stringify(state.catalysts[0], null, 2));
console.log('[ROPES DEBUG] cards with tags:', state.catalysts.filter(c => c.tags && c.tags.length > 0).length);
console.log('[ROPES DEBUG] cards with narrative:', state.catalysts.filter(c => c.narrative).length);
```

### Step 2: Check filtered catalysts

Add log after `filteredCatalysts` computation (~line 530):

```typescript
console.log('[ROPES DEBUG] filteredCatalysts:', filteredCatalysts.length);
console.log('[ROPES DEBUG] visibleLaneIds:', visibleLaneIds.size, [...visibleLaneIds]);
console.log('[ROPES DEBUG] activeTags:', activeTags.size);
```

### Step 3: Check edge generation

Add log inside `buildEdges()` at line 413:

```typescript
console.log('[ROPES DEBUG] buildEdges called with', catalysts.length, 'catalysts, zoom:', zoomLevel, 'nodeIds:', nodeIds.size);
const hubRopes = computeHubRopes(catalysts);
console.log('[ROPES DEBUG] hubRopes computed:', hubRopes.length);
// ... after cross ropes
const crossRopes = computeRopeConnections(catalysts, 200);
console.log('[ROPES DEBUG] crossRopes computed:', crossRopes.length);
console.log('[ROPES DEBUG] total edges:', edges.length);
```

### Step 4: Check if ropes are filtered by nodeIds

After the `nodeIds` filtering inside buildEdges:

```typescript
// For hub ropes
let hubSkipped = 0;
for (const rope of hubRopes) {
  const targetId = rope.toId.replace('group-', 'hub-');
  if (!nodeIds.has(rope.fromId) || !nodeIds.has(targetId)) {
    hubSkipped++;
    if (hubSkipped <= 3) console.log('[ROPES DEBUG] hub rope skipped:', rope.fromId, '→', targetId, 'fromExists:', nodeIds.has(rope.fromId), 'toExists:', nodeIds.has(targetId));
  }
}
```

### Step 5: Based on debug output, apply fixes

---

## Fixes to Apply

### Fix A: RiskFlow imports missing narrative field

In `frontend/lib/narrative-seed-loader.ts`, the `importRiskFlowItems()` function (line 69-99) does NOT set `narrative` or `narrativeThreads`. Add a heuristic mapping:

```typescript
// Inside the .map() callback, after the existing fields:
narrative: guessNarrativeThread(a), // NEW — add this
narrativeThreads: guessNarrativeThread(a) ? [guessNarrativeThread(a)!] : [],
```

Add this helper function above `importRiskFlowItems`:

```typescript
function guessNarrativeThread(alert: RiskFlowAlert): string | undefined {
  const headline = (alert.headline + ' ' + (alert.summary ?? '')).toLowerCase();
  const tagStr = (alert.tags ?? []).join(' ').toLowerCase();
  const combined = headline + ' ' + tagStr;

  // Match against known narrative thread keywords
  const threadKeywords: [string, string[]][] = [
    ['trade-war', ['tariff', 'trade war', 'trade-war', 'sanctions', 'import duty']],
    ['rate-cut-cycle', ['rate cut', 'fed cut', 'rate-cut', 'fomc', 'fed funds', 'monetary easing']],
    ['price-stability', ['cpi', 'inflation', 'pce', 'deflation', 'price stability']],
    ['maximum-employment', ['nfp', 'jobs', 'unemployment', 'payroll', 'labor', 'employment']],
    ['ai-singularity', ['ai ', 'artificial intelligence', 'nvidia', 'gpu', 'machine learning', 'openai']],
    ['usd-jpy-carry-trade', ['yen', 'jpy', 'carry trade', 'boj', 'japan']],
    ['middle-east-conflict', ['iran', 'israel', 'middle east', 'oil shock', 'houthi']],
    ['liquidity-credit-contraction', ['liquidity', 'credit', 'banking', 'svb', 'credit spread']],
    ['trump-presidency', ['trump', 'executive order', 'maga', 'republican']],
    ['us-china-relations', ['china', 'xi jinping', 'taiwan', 'us-china', 'beijing']],
  ];

  for (const [slug, keywords] of threadKeywords) {
    if (keywords.some(kw => combined.includes(kw))) return slug;
  }
  return undefined;
}
```

### Fix B: Stale localStorage missing fields

Cards saved to localStorage before the `tags`/`narrative` fields existed will lack them. In `loadNarrativeState()` (narrative-store.ts), add field normalization:

```typescript
export function loadNarrativeState(): NarrativeFlowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = { ...defaultState(), ...JSON.parse(raw) };
    // Normalize catalysts — ensure tags and narrative fields exist
    parsed.catalysts = parsed.catalysts.map((c: any) => ({
      ...c,
      tags: c.tags ?? [],
      narrative: c.narrative ?? undefined,
      narrativeThreads: c.narrativeThreads ?? [],
    }));
    return parsed;
  } catch {
    return defaultState();
  }
}
```

### Fix C: Force re-seed to pull latest seed data with tags

Bump the seed version to force re-import. In `narrative-seed-loader.ts`:

```typescript
const SEED_FLAG = 'fintheon:narrative-seeded:v9'; // was v8, bump to v9
```

This forces `loadSeedEvents()` to re-run and re-add all seed events with proper tags and narrative fields.

### Fix D: Ensure force simulation assigns positions to ALL cards

In `buildSimData()` (NarrativeForceCanvas.tsx), verify every card gets a SimNode. If a card's narrative thread isn't in NARRATIVE_THREADS, it may not get a hub-relative position. Check the `threadSlug` assignment:

```typescript
// In buildSimData, ensure every card gets a valid threadSlug
const threadSlug = card.narrative ?? card.narrativeThreads?.[0] ?? 'price-stability'; // fallback to a default
```

### Fix E: Edge visibility — increase rope opacity for debugging

The hub-to-catalyst ropes have `opacity: 0.12` (line 462) which is VERY subtle. Temporarily increase to `opacity: 0.4` to confirm they're rendering, then tune back.

---

## Files to Modify

| File | What to Change |
|------|---------------|
| `frontend/lib/narrative-seed-loader.ts` | Add `guessNarrativeThread()` helper + set `narrative`/`narrativeThreads` on RiskFlow imports. Bump SEED_FLAG to v9. |
| `frontend/lib/narrative-store.ts` | Add field normalization in `loadNarrativeState()` for tags/narrative/narrativeThreads |
| `frontend/components/narrative/NarrativeForceCanvas.tsx` | Debug logs (temporary), ensure buildSimData handles missing threadSlug, verify buildEdges output |

---

## Verification

1. Open browser, navigate to Consilium → Sanctum tab
2. Open DevTools console — check for `[ROPES DEBUG]` logs
3. Confirm: `catalysts in store > 0`, `cards with tags > 0`, `cards with narrative > 0`
4. Confirm: `hubRopes computed > 0`, `crossRopes computed > 0`, `total edges > 0`
5. **VISUAL**: You should see thin thread-colored lines from cards to their narrative hubs (breathing animation), and gold lines between cards sharing tags across different narratives
6. Remove debug `console.log` statements after confirming ropes work
7. Run `npx tsc --noEmit` — must pass
8. Run `bun run build` — must pass

---

## Changelog Entry

```typescript
{ date: '2026-03-29T__:__:__', agent: 'claude-code', summary: 'fix(sanctum): rope rendering pipeline — normalize stored cards, add narrative thread to RiskFlow imports, bump seed version, increase rope visibility', files: ['frontend/lib/narrative-seed-loader.ts', 'frontend/lib/narrative-store.ts', 'frontend/components/narrative/NarrativeForceCanvas.tsx'] }
```

---

## DO NOT

- Do NOT touch `ConsiliumHub.tsx` (that's T2's scope)
- Do NOT modify the zoom tier system (that's T3's scope)
- Do NOT touch any Apparatus files (that's T4's scope)
- Do NOT rewrite the rope engine — the engine is correct, the data is the problem
- Do NOT add new node types — existing nodeTypes are fine
- Do NOT remove the `rope-breathe` CSS — it's correct, just needs edges to animate
