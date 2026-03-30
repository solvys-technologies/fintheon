# S5-T2: Sanctum 50% Overlay Panel + KPI Card Data Fix

**Sprint:** S5 — NarrativeFlow Intelligence Map
**Track:** T2 (Frontend — Sanctum layout)
**Depends On:** T1 types (for `marketImpact` type, but can proceed with inline type if T1 not done)
**Parallel With:** T3, T4, T5

---

## Context

The Sanctum currently renders as a push-panel (NarrativeGrid shrinks to 60% when Sanctum opens). TP wants it as a **50% overlay** — a true slide-out drawer that sits on top of the map, which stays full-width underneath.

Additionally, the Sanctum's Econ Intel KPI cards are "broken" — they don't show market impact data for HIGH/CRITICAL scored RiskFlow items older than 24h. This track wires that data through.

---

## Files to Read First

- `frontend/components/narrative/NarrativeFlow.tsx` — lines 232-248, how Sanctum is positioned
- `frontend/components/narrative/Sanctum.tsx` — the 3-page snap-scroll dashboard
- `frontend/components/narrative/SanctumEconIntel.tsx` — Econ Intel cards that need market impact
- `frontend/components/proposals/ProposalWidget.tsx` — reference for slide-out panel pattern
- `frontend/components/layout/MainLayout.tsx` — how the right panel works (for pattern reference)

---

## Task 1: Convert Sanctum to 50% Overlay

**File:** `frontend/components/narrative/NarrativeFlow.tsx` (modify)

Replace the current push-panel layout:

```tsx
// BEFORE (current push-panel):
<div className={auditoriumOpen ? 'w-[60%]' : 'w-full'}>
  <NarrativeGridView />
</div>
{auditoriumOpen && <Sanctum ... />}

// AFTER (overlay):
<div className="w-full relative">
  <NarrativeGridView /> {/* or NarrativeMapView — stays full width always */}

  {/* Sanctum overlay — slides in from right, 50% width */}
  <div
    className={`fixed top-0 right-0 h-full z-40 transition-transform duration-300 ease-out ${
      auditoriumOpen ? 'translate-x-0' : 'translate-x-full'
    }`}
    style={{ width: '50vw' }}
  >
    <div className="h-full bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-border)]/20 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]">
      {/* Close button */}
      <button
        onClick={() => setSanctumOpen(false)}
        className="absolute top-4 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--fintheon-surface)]/60 text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <Sanctum
        data={mirofishData}
        onRun={handleRunMiroFish}
        catalysts={catalystsForKanban}
        riskflowItems={riskflowItems}
        macroContext={mirofishData?.contextSnapshot ?? null}
      />
    </div>
  </div>
</div>
```

Import `X` from `lucide-react`.

Remove the `transition: width 0.3s ease` from the NarrativeGridView container — it no longer needs to resize.

---

## Task 2: Fix Econ Intel KPI Cards — Wire Market Impact Data

**File:** `frontend/components/narrative/SanctumEconIntel.tsx` (modify)

The econ cards need to show market impact (NQ/ES/YM close performance) for scored RiskFlow items with HIGH/CRITICAL priority that are older than 24h. The data will come from T4's cron pipeline (via `marketImpact` field on scored items), but the frontend needs to display it when available.

In the expanded detail of each `EconCard`, add a "Market Impact" section:

```tsx
{/* Market Impact — shows if scored items have marketImpact data */}
{scoredItems.some(s => s.marketImpact) && (
  <div>
    <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">
      Market Impact (Day Close)
    </span>
    <div className="grid grid-cols-3 gap-2">
      {['nq', 'es', 'ym'].map(sym => {
        const impact = scoredItems.find(s => s.marketImpact?.[sym])?.marketImpact?.[sym];
        if (!impact) return null;
        const color = impact.percent > 0 ? 'var(--fintheon-low)' : impact.percent < 0 ? 'var(--fintheon-severe)' : 'var(--fintheon-muted)';
        return (
          <div key={sym} className="rounded bg-[var(--fintheon-bg)]/40 border border-[var(--fintheon-border)]/5 px-2 py-1.5">
            <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/40 uppercase block">{sym.toUpperCase()}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color }}>
              {impact.points > 0 ? '+' : ''}{impact.points.toFixed(0)} pts
            </span>
            <span className="text-[9px] font-mono block" style={{ color }}>
              {impact.percent > 0 ? '+' : ''}{impact.percent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  </div>
)}
```

Also update the `EconScoredItem` type in `frontend/types/mirofish.ts` to include marketImpact:

```typescript
export interface EconScoredItem {
  // ... existing fields ...
  marketImpact?: {
    nq: { points: number; percent: number } | null;
    es: { points: number; percent: number } | null;
    ym: { points: number; percent: number } | null;
    asOf: string;
  };
}
```

---

## Task 3: Update Econ History Endpoint Response

**File:** `backend-hono/src/routes/data/index.ts` (modify)

In the `/econ-history/:ticker` handler, include `market_impact` from scored items if present:

```typescript
// In the scored items transformation (around line 399):
const scoring = scoredItems.map((s) => ({
  id: s.tweet_id,
  headline: s.headline,
  ivScore: s.iv_score ?? null,
  macroLevel: s.macro_level ?? null,
  sentiment: s.sentiment ?? null,
  riskType: s.risk_type ?? null,
  subScores: s.sub_scores ?? null,
  econData: s.econ_data ?? null,
  publishedAt: s.published_at ?? null,
  marketImpact: s.market_impact ?? null,  // ADD THIS
}));
```

---

## Verification

```bash
# Type-check
npx tsc --noEmit 2>&1 | grep "frontend/" | head -10

# Build
npx vite build 2>&1 | tail -5

# Verify overlay class exists
grep -n "translate-x-full\|50vw\|overlay" frontend/components/narrative/NarrativeFlow.tsx

# Verify market impact display
grep -n "marketImpact\|Market Impact" frontend/components/narrative/SanctumEconIntel.tsx
```

---

## Changelog Entry

```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S5-T2: Converted Sanctum from push-panel to 50% overlay drawer. Map stays full-width underneath. Added Market Impact display (NQ/ES/YM close) to Econ Intel scored items. Updated econ-history endpoint to pass market_impact.', files: ['frontend/components/narrative/NarrativeFlow.tsx', 'frontend/components/narrative/SanctumEconIntel.tsx', 'frontend/types/mirofish.ts', 'backend-hono/src/routes/data/index.ts'] }
```

---

## DO NOT

- Do NOT modify Sanctum.tsx internals (pages, KPI row, briefing) — S4 already handled that
- Do NOT change the NarrativeGridView or tree-map layout — T1/T3 handle those
- Do NOT implement the market impact cron/pipeline — T4 handles the backend
- Do NOT add animation/motion — T5 handles that
- Do NOT change the Proposals panel or MainLayout — reference only
