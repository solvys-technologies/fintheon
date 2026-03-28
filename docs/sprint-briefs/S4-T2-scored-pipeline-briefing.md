# S4-T2: Backend Scored Items Pipeline + Briefing Rewrite

**Sprint:** S4 — Sanctum Intelligence Overhaul
**Track:** T2 (Backend)
**Depends On:** T1 foundation already landed (types, econ history, API route)
**Parallel With:** T3 (frontend KPI rewrite), T4 (frontend risk assessment)

---

## Context

The Sanctum's MiroFish simulation fetches RiskFlow headlines from `scored_riskflow_items` but only selects thin columns (`id, title, summary, macro_level, sentiment, iv_score, category, created_at`). The full scored data — `sub_scores`, `econ_data`, `risk_type`, `agent_note`, `price_brain_score` — is never fetched or passed through.

The briefing generator (`mirofish-briefing.ts`) is 100% deterministic but outputs raw jargon: "Composite IV at 6.2/10 (elevated). Regime shift probability 42%." It also ignores the new `econPrintHistory` in the context.

This track widens the query, updates the types, and rewrites the briefing templates to use trader-friendly language.

---

## Files to Read First

- `backend-hono/src/services/mirofish/mirofish-context.ts` — context assembly, `fetchRiskFlowHeadlines()` at line 80
- `backend-hono/src/services/mirofish/mirofish-types.ts` — `RiskFlowHeadline` interface at line 139, `SimulationContext` at line 161
- `backend-hono/src/services/mirofish/mirofish-briefing.ts` — deterministic briefing generator (106 lines)
- `backend-hono/src/services/mirofish/mirofish-service.ts` — how context flows into seed + debate
- `backend-hono/src/services/supabase-service.ts` — `ScoredRiskFlowItem` type at line 20
- `frontend/types/mirofish.ts` — `RiskFlowCatalyst` interface at line 192, `SimulationContext` at line 214

---

## Task 1: Widen RiskFlow Query

**File:** `backend-hono/src/services/mirofish/mirofish-context.ts`

Change the `fetchRiskFlowHeadlines()` Supabase select to include full scored data:

```typescript
// BEFORE (line 88):
.select('id, title, summary, macro_level, sentiment, iv_score, category, created_at')

// AFTER:
.select('id, title, summary, macro_level, sentiment, iv_score, category, created_at, sub_scores, econ_data, risk_type, agent_note, price_brain_score')
```

No other changes needed in this file.

---

## Task 2: Widen RiskFlowHeadline Type (Backend)

**File:** `backend-hono/src/services/mirofish/mirofish-types.ts`

Update `RiskFlowHeadline` (line 139) to include the new fields:

```typescript
export interface RiskFlowHeadline {
  id: string;
  title: string;
  summary: string;
  macro_level: number;
  sentiment: string;
  iv_score: number;
  category?: string;
  created_at: string;
  // ── New: full scored metadata ──
  sub_scores?: {
    eventWeight?: number;
    timing?: number;
    deviation?: number;
    momentum?: number;
    vixContext?: number;
    vixMultiplier?: number;
    regimeMultiplier?: number;
    regimeName?: string;
    commentatorMultiplier?: number;
    speaker?: string | null;
  } | null;
  econ_data?: {
    actual?: number;
    forecast?: number;
    previous?: number;
    beatMiss?: 'beat' | 'miss' | 'inline';
    surprisePercent?: number;
  } | null;
  risk_type?: string | null;
  agent_note?: string | null;
  price_brain_score?: {
    sentiment?: string;
    classification?: string;
    impliedPoints?: number | null;
    instrument?: string | null;
  } | null;
}
```

---

## Task 3: Widen RiskFlowCatalyst Type (Frontend)

**File:** `frontend/types/mirofish.ts`

Update `RiskFlowCatalyst` (line 192) to mirror the backend shape:

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
  // ── New: full scored metadata ──
  sub_scores?: {
    eventWeight?: number;
    timing?: number;
    deviation?: number;
    momentum?: number;
    vixContext?: number;
    vixMultiplier?: number;
    regimeMultiplier?: number;
    regimeName?: string;
    commentatorMultiplier?: number;
    speaker?: string | null;
  } | null;
  econ_data?: {
    actual?: number;
    forecast?: number;
    previous?: number;
    beatMiss?: 'beat' | 'miss' | 'inline';
    surprisePercent?: number;
  } | null;
  risk_type?: string | null;
  agent_note?: string | null;
  price_brain_score?: {
    sentiment?: string;
    classification?: string;
    impliedPoints?: number | null;
    instrument?: string | null;
  } | null;
}
```

---

## Task 4: Rewrite Briefing Generator

**File:** `backend-hono/src/services/mirofish/mirofish-briefing.ts`

This is the main deliverable. Rewrite `generateBriefing()` to produce trader-friendly analysis. Keep it deterministic (no LLM call). The language should read like a desk analyst note, not a data dump.

### Naming Convention (MUST follow):
- "Composite IV" → **"Market Heat"** (0-10 scale)
- "Regime shift probability" → **"Regime Risk"**
- "Model confidence" → **"Signal Strength"**
- "IV Score" → **"Heat Score"** (when referring to category scores)
- "Delta" → **"Momentum"** (in the context of category score changes)

### Summary Rewrite:

Replace the current pattern:
```
Composite IV at 6.2/10 (elevated). Regime shift probability 42%. Model confidence 78%.
```

With interpretive trader language:
```
Market heat elevated at 6.2 — expect wider ranges and faster reversals.
Regime risk at 42% — structural shift possible, tighten stops on trend trades.
Signal strength 78% — high-conviction read, size accordingly.
Primary driver: Geopolitical (7.3) — tariff/sanctions headlines dominating tape.
```

Use these interpretation rules:
- Heat 0-3: "Low heat — range-bound, fade extremes"
- Heat 3-5: "Moderate heat — normal conditions, play the setups"
- Heat 5-7: "Elevated heat — expect wider ranges and faster reversals"
- Heat 7-9: "High heat — reduce size, widen stops, favor reactive over predictive"
- Heat 9-10: "Extreme heat — capital preservation mode, hedge or sit flat"

### Key Findings Rewrite:

Replace:
```
Geopolitical: IV 7.3 (rising, conf 82%)
```

With:
```
Geopolitical heat 7.3 and rising — tariff/sanctions cycle accelerating. 82% signal strength.
```

For each category finding, add a one-line trading implication based on the category:
- Geopolitical/Political: "Watch /ES for gap risk, avoid overnight holds"
- Monetary Policy: "Bonds lead — check /ZN before equity entries"
- Earnings/Corporate: "Single-stock vol elevated — spreads over directional"
- Market Structure: "Liquidity thinning — reduce size on breakouts"
- Black Swan: "Tail risk elevated — consider put spreads or stay flat"

### Econ Print Integration:

**NEW:** Use `context.econPrintHistory` (now available in SimulationContext). If prints exist:

```typescript
if (context.econPrintHistory?.length) {
  const beats = context.econPrintHistory.filter(p => p.direction === 'beat').length;
  const misses = context.econPrintHistory.filter(p => p.direction === 'miss').length;
  const total = context.econPrintHistory.length;

  if (beats > misses * 2) {
    keyFindings.push(`Econ prints running hot — ${beats}/${total} beats in the last 7d. Watch for hawkish Fed repricing.`);
  } else if (misses > beats * 2) {
    keyFindings.push(`Econ prints running cold — ${misses}/${total} misses in the last 7d. Rate cut expectations should firm up.`);
  } else {
    keyFindings.push(`Econ prints mixed — ${beats} beats, ${misses} misses out of ${total}. No clear macro directional bias.`);
  }

  // Flag any high-IV prints
  const hotPrints = context.econPrintHistory.filter(p => p.ivScore != null && p.ivScore >= 6);
  if (hotPrints.length > 0) {
    keyFindings.push(`${hotPrints.length} high-impact print(s) this week — ${hotPrints.map(p => p.eventName).join(', ')}.`);
  }
}
```

### Risk Alerts Rewrite:

Replace:
```
Geopolitical IV at 7.3 — elevated risk
```

With:
```
Geopolitical heat 7.3 — elevated. Reduce overnight exposure, widen stops on /ES.
```

Replace:
```
Regime shift probability 42% — potential structural change
```

With:
```
Regime risk 42% — market may be transitioning. Trend models unreliable until confirmed.
```

### Scored Items Integration:

Use the new scored RiskFlow headline data to enrich risk alerts:

```typescript
if (context.riskflowHeadlines.length > 0) {
  const highImpact = context.riskflowHeadlines.filter(h => h.iv_score >= 6);
  if (highImpact.length > 0) {
    // Group by risk_type for cleaner output
    const byType = new Map<string, number>();
    for (const h of highImpact) {
      const type = h.risk_type ?? 'General';
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    const breakdown = [...byType.entries()].map(([t, n]) => `${n} ${t}`).join(', ');
    riskAlerts.push(`${highImpact.length} high-heat headlines in 72h window: ${breakdown}.`);
  }

  // Surface any headlines with econ_data (print-related)
  const econHeadlines = context.riskflowHeadlines.filter(h => h.econ_data != null);
  if (econHeadlines.length > 0) {
    const latest = econHeadlines[0];
    const bm = latest.econ_data?.beatMiss;
    if (bm === 'beat' || bm === 'miss') {
      riskAlerts.push(`Latest print ${bm === 'beat' ? 'came in hot' : 'disappointed'}: "${latest.title}" — ${latest.econ_data?.surprisePercent?.toFixed(1) ?? '?'}% surprise.`);
    }
  }
}
```

### Agent Consensus Rewrite:

Replace:
```
5 agents voted: 3 high-vol, 1 neutral, 1 low-vol
```

With:
```
Agent panel: 3/5 see elevated vol, 1 neutral, 1 contrarian. Consensus leans volatile — favor mean-reversion setups over trend continuation.
```

Add interpretation:
- If >60% high-vol: "Consensus leans volatile — favor mean-reversion setups"
- If >60% low-vol: "Consensus leans calm — trend continuation and breakout setups preferred"
- If mixed: "No strong consensus — reduce position sizing until direction clarifies"

---

## Verification

```bash
# Type-check backend
cd backend-hono && npx tsc --noEmit

# Type-check frontend
cd frontend && npx tsc --noEmit

# Verify the widened select compiles
grep -n "sub_scores\|econ_data\|risk_type\|agent_note\|price_brain_score" backend-hono/src/services/mirofish/mirofish-context.ts

# Verify briefing no longer contains old jargon patterns
grep -n "Composite IV at\|Regime shift probability\|Model confidence" backend-hono/src/services/mirofish/mirofish-briefing.ts
# ^ Should return 0 matches after rewrite
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S4-T2: Widened RiskFlow scored items query (sub_scores, econ_data, risk_type, agent_note, price_brain_score). Rewrote briefing generator with trader-friendly language (Market Heat, Regime Risk, Signal Strength). Added econ print pattern analysis and scored items integration to briefing output.', files: ['backend-hono/src/services/mirofish/mirofish-context.ts', 'backend-hono/src/services/mirofish/mirofish-types.ts', 'backend-hono/src/services/mirofish/mirofish-briefing.ts', 'frontend/types/mirofish.ts'] }
```

---

## DO NOT

- Do NOT touch `Sanctum.tsx`, `SanctumEconIntel.tsx`, or any frontend component — that's T3/T4 scope
- Do NOT touch `mirofish-service.ts` beyond what's needed for the context flow — the service already passes context through correctly
- Do NOT add LLM calls to the briefing generator — keep it deterministic
- Do NOT modify the Supabase table schema — the columns already exist
- Do NOT change the econ-history endpoint or supabase-service — T1 already handled that
