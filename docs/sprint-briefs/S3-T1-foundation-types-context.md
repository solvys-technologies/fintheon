# S3-T1: Foundation — Types + Context Pipeline

**Sprint:** S3 (Sanctum Intelligence Overhaul)
**Track:** T1 — Foundation
**Dependencies:** None (runs first; T2/T3/T4 depend on this)

---

## Objective
Expand the RiskFlow data flowing into Sanctum from 7 basic columns to the full scored item shape (sub_scores, econ_data, risk_type, agent_note, price_brain_score). Update types on both backend and frontend so downstream tracks can consume rich data.

---

## Files to Read First
- `backend-hono/src/types/riskflow.ts` — FeedItem, SubScoreBreakdown, existing scored item types
- `backend-hono/src/services/mirofish/mirofish-types.ts` — current RiskFlowHeadline (7 fields only)
- `backend-hono/src/services/mirofish/mirofish-context.ts` — assembleSimulationContext + fetchRiskFlowHeadlines
- `frontend/types/mirofish.ts` — RiskFlowCatalyst, SimulationContext
- `frontend/components/narrative/NarrativeFlow.tsx` — renders Sanctum without riskflowItems/macroContext
- `frontend/components/consilium/ConsiliumHub.tsx` — renders Sanctum WITH riskflowItems (line ~242)

---

## Files to Modify

### 1. `backend-hono/src/services/mirofish/mirofish-types.ts`

**What:** Replace the slim `RiskFlowHeadline` with a rich `ScoredRiskFlowContext` that includes all scoring metadata.

```typescript
// REPLACE the existing RiskFlowHeadline interface (lines ~139-148) with:

export interface RiskFlowHeadline {
  id: string;
  title: string;
  summary: string;
  macro_level: number;
  sentiment: string;
  iv_score: number;
  category?: string;
  created_at: string;
  // ── New scored fields ──
  risk_type?: 'Macro' | 'Geopolitical' | 'Earnings' | 'Technical' | 'Credit' | 'Liquidity' | 'Commentary' | null;
  agent_note?: string | null;
  agent_note_generated_at?: string | null;
  econ_data?: {
    actual?: number | null;
    forecast?: number | null;
    previous?: number | null;
    beatMiss?: 'beat' | 'miss' | 'inline' | null;
    surprisePercent?: number | null;
  } | null;
  sub_scores?: {
    eventWeight: number;
    timing: number;
    deviation: number;
    momentum: number;
    vixContext: number;
    vixMultiplier: number;
    regimeMultiplier?: number;
    regimeName?: string;
    commentatorMultiplier?: number;
    speaker?: string | null;
  } | null;
  price_brain_score?: {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
    impliedPoints: number | null;
    instrument: string | null;
  } | null;
}
```

Keep backward compat — all new fields are optional.

### 2. `backend-hono/src/services/mirofish/mirofish-context.ts`

**What:** Expand the Supabase select in `fetchRiskFlowHeadlines()` to fetch all scored columns.

Replace the `.select(...)` call (line ~51-52):
```typescript
// OLD:
.select('id, title, summary, macro_level, sentiment, iv_score, category, created_at')

// NEW:
.select('id, title, summary, macro_level, sentiment, iv_score, category, created_at, risk_type, agent_note, agent_note_generated_at, econ_data, sub_scores, price_brain_score')
```

The column names in `scored_riskflow_items` match these field names (snake_case in Supabase). Supabase returns JSONB columns as parsed objects automatically.

### 3. `frontend/types/mirofish.ts`

**What:** Expand `RiskFlowCatalyst` to include all scored fields so frontend components can consume them.

Replace the existing `RiskFlowCatalyst` interface (lines ~152-161):
```typescript
export interface RiskFlowCatalyst {
  id: string;
  title: string;
  summary: string;
  macro_level: number;
  sentiment: string;
  iv_score: number;
  category?: string;
  created_at: string;
  // ── Scored fields ──
  risk_type?: 'Macro' | 'Geopolitical' | 'Earnings' | 'Technical' | 'Credit' | 'Liquidity' | 'Commentary' | null;
  agent_note?: string | null;
  agent_note_generated_at?: string | null;
  econ_data?: {
    actual?: number | null;
    forecast?: number | null;
    previous?: number | null;
    beatMiss?: 'beat' | 'miss' | 'inline' | null;
    surprisePercent?: number | null;
  } | null;
  sub_scores?: {
    eventWeight: number;
    timing: number;
    deviation: number;
    momentum: number;
    vixContext: number;
    vixMultiplier: number;
    regimeMultiplier?: number;
    regimeName?: string;
    commentatorMultiplier?: number;
    speaker?: string | null;
  } | null;
  price_brain_score?: {
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    classification: 'Cyclical' | 'Counter-cyclical' | 'Neutral';
    impliedPoints: number | null;
    instrument: string | null;
  } | null;
}
```

### 4. `frontend/components/narrative/NarrativeFlow.tsx`

**What:** Add context fetch on mount + pass `riskflowItems` and `macroContext` to `<Sanctum>`.

The ConsiliumHub already does this (line ~91-101). Replicate the same pattern in NarrativeFlow:

**Add state variables** (near line 29, after mirofishData state):
```typescript
const [riskflowItems, setRiskflowItems] = useState<RiskFlowCatalyst[]>([]);
const [macroContext, setMacroContext] = useState<SimulationContext | null>(null);
```

**Add imports** for `RiskFlowCatalyst` and `SimulationContext` from `../../types/mirofish`.

**Add context fetch effect** (after the existing useEffects):
```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mirofish/context`);
      if (res.ok) {
        const ctx = await res.json();
        if (!cancelled) {
          setMacroContext(ctx);
          if (ctx.riskflowHeadlines) setRiskflowItems(ctx.riskflowHeadlines);
        }
      }
    } catch (err) {
      console.warn('[NarrativeFlow] Context fetch failed:', err);
    }
  })();
  return () => { cancelled = true; };
}, []);
```

**Update the Sanctum render** (line ~188-193):
```tsx
<Sanctum
  data={mirofishData}
  onRun={handleRunMiroFish}
  catalysts={catalystsForKanban}
  riskflowItems={riskflowItems}
  macroContext={macroContext}
/>
```

---

## Key Rules
- All new fields on RiskFlowHeadline and RiskFlowCatalyst are OPTIONAL — existing code must not break
- Keep the interface name `RiskFlowHeadline` (backend) and `RiskFlowCatalyst` (frontend) — don't rename
- The Supabase column names are snake_case and match exactly: `risk_type`, `agent_note`, `econ_data`, `sub_scores`, `price_brain_score`
- JSONB columns (econ_data, sub_scores, price_brain_score) are auto-parsed by Supabase client

---

## DO NOT
- Modify Sanctum.tsx, SanctumEconIntel.tsx, SanctumRiskAssessment.tsx, or SanctumBriefing.tsx (those are T3/T4)
- Modify mirofish-briefing.ts or mirofish-service.ts (that's T2)
- Change the SimulationContext interface structure (riskflowHeadlines stays as RiskFlowHeadline[])
- Add any new API endpoints

---

## Verification
```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit  # Zero type errors
bun run build     # Clean Vite build
cd backend-hono && npx tsc --noEmit  # Backend types clean
```

---

## Changelog Entry
```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S3-T1: Expanded RiskFlowHeadline/RiskFlowCatalyst types with full scored fields (sub_scores, econ_data, risk_type, agent_note, price_brain_score). Updated mirofish-context to fetch all scored columns. Wired NarrativeFlow to pass riskflowItems + macroContext to Sanctum.', files: ['backend-hono/src/services/mirofish/mirofish-types.ts', 'backend-hono/src/services/mirofish/mirofish-context.ts', 'frontend/types/mirofish.ts', 'frontend/components/narrative/NarrativeFlow.tsx'] }
```
