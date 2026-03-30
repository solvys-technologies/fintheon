# S4-T3: KPI Trading Lingo + Interpretation Layer + Briefing Display

**Sprint:** S4 — Sanctum Intelligence Overhaul
**Track:** T3 (Frontend — Command Center)
**Depends On:** T1 foundation (done), T2 briefing rewrite (parallel — T3 uses current briefing shape, T2 improves content)
**Parallel With:** T2 (backend), T4 (frontend risk assessment)

---

## Context

The Sanctum Command Center (Page 0) displays 3 KPI cards and a briefing panel. The KPIs currently show raw quant jargon: "Composite IV", "Regime Shift", "Model Confidence" — meaningless to a technical trader who doesn't know the internal scoring system. The briefing panel renders the summary text as-is with no formatting hierarchy.

This track rewrites the KPI labels to trading lingo, adds interpretive sub-text that explains what the numbers mean in practice, and improves the briefing display so the analysis actually reads well.

---

## Files to Read First

- `frontend/components/narrative/Sanctum.tsx` — KPI row at lines ~208-237, briefing at ~239-242
- `frontend/components/narrative/SanctumBriefing.tsx` — briefing display component
- `frontend/types/mirofish.ts` — `SanctumData`, `MiroFishBriefing` types
- `frontend/components/narrative/SanctumEconIntel.tsx` — reference for category score interpretation text (lines 577-583)

---

## Task 1: Rewrite KPI Row Labels + Add Interpretation

**File:** `frontend/components/narrative/Sanctum.tsx`

The KPI row is around lines 208-237. Replace the 3 KPI cards with trader-friendly names and add interpretive sub-labels.

### Card 1: Market Heat (was "Composite IV")

Replace:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Composite IV</span>
<span className="text-3xl font-bold text-[var(--fintheon-accent)]">{data.compositeIV.toFixed(1)}</span>
```

With:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Market Heat</span>
<span className="text-3xl font-bold text-[var(--fintheon-accent)]">{data.compositeIV.toFixed(1)}</span>
<span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{heatInterpretation(data.compositeIV)}</span>
```

### Card 2: Regime Risk (was "Regime Shift")

Replace:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Regime Shift</span>
<span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.regimeShiftProbability * 100).toFixed(0)}%</span>
```

With:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Regime Risk</span>
<span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.regimeShiftProbability * 100).toFixed(0)}%</span>
<span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{regimeInterpretation(data.regimeShiftProbability)}</span>
```

### Card 3: Signal Strength (was "Model Confidence")

Replace:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Model Confidence</span>
<span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.confidence * 100).toFixed(0)}%</span>
```

With:
```tsx
<span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">Signal Strength</span>
<span className="text-2xl font-bold text-[var(--fintheon-text)]">{(data.confidence * 100).toFixed(0)}%</span>
<span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">{confidenceInterpretation(data.confidence)}</span>
```

### Interpretation Helper Functions

Add these above the component (below the imports):

```typescript
function heatInterpretation(score: number): string {
  if (score >= 9) return 'Extreme — capital preservation mode';
  if (score >= 7) return 'High — reduce size, widen stops';
  if (score >= 5) return 'Elevated — wider ranges, faster reversals';
  if (score >= 3) return 'Moderate — normal conditions';
  return 'Low — range-bound, fade extremes';
}

function regimeInterpretation(probability: number): string {
  const pct = probability * 100;
  if (pct >= 60) return 'Likely shifting — trend models unreliable';
  if (pct >= 30) return 'Possible — tighten stops on trend trades';
  if (pct >= 15) return 'Low risk — current regime holding';
  return 'Stable — no structural change expected';
}

function confidenceInterpretation(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 80) return 'High conviction — size accordingly';
  if (pct >= 60) return 'Moderate — standard positioning';
  if (pct >= 40) return 'Uncertain — reduce exposure';
  return 'Low — consider sitting out';
}
```

---

## Task 2: Improve Briefing Display

**File:** `frontend/components/narrative/SanctumBriefing.tsx`

Read the file first. The current briefing component renders `briefing.summary`, `briefing.keyFindings`, `briefing.riskAlerts`, and `briefing.agentConsensus`.

Enhance the display with:

1. **Summary** — render as a lead paragraph with slightly larger text and gold accent border-left
2. **Key Findings** — render as a numbered list with monospace accent on any numbers/percentages found in the text
3. **Risk Alerts** — render with a severity indicator (red left border if the text contains "elevated", "extreme", or "critical"; amber otherwise)
4. **Agent Consensus** — render with a subtle background pill, slightly muted

### Updated Structure:

```tsx
export function SanctumBriefing({ briefing, isLoading }: { briefing: MiroFishBriefing | null; isLoading: boolean }) {
  if (!briefing) return null;

  return (
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/30 overflow-hidden">
      {/* Summary — lead paragraph */}
      <div className="px-5 py-4 border-l-2 border-[var(--fintheon-accent)]/40">
        <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">Analysis</span>
        <p className="text-[11px] text-[var(--fintheon-text)]/80 leading-relaxed">
          {briefing.summary}
        </p>
      </div>

      {/* Key Findings */}
      {briefing.keyFindings.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">Key Findings</span>
          <div className="flex flex-col gap-1.5">
            {briefing.keyFindings.map((finding, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] font-mono text-[var(--fintheon-accent)]/60 w-4 shrink-0">{i + 1}.</span>
                <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">{finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {briefing.riskAlerts.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">Risk Alerts</span>
          <div className="flex flex-col gap-1.5">
            {briefing.riskAlerts.map((alert, i) => {
              const isSevere = /elevated|extreme|critical|high.heat/i.test(alert);
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 pl-2 border-l-2 rounded-r"
                  style={{ borderLeftColor: isSevere ? 'var(--fintheon-severe)' : 'var(--fintheon-neutral-severe)' }}
                >
                  <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">{alert}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Consensus */}
      {briefing.agentConsensus && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <div className="inline-block px-3 py-1.5 rounded bg-[var(--fintheon-accent)]/8">
            <span className="text-[9px] text-[var(--fintheon-accent)]/70">{briefing.agentConsensus}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 3: Update Category Score Interpretation Text

**File:** `frontend/components/narrative/SanctumEconIntel.tsx`

The category score expanded detail (around line 577-583) uses generic "IV delta" language. Update to trading lingo:

Replace:
```
IV delta of +X indicates increasing implied volatility pressure.
```

With category-specific interpretations:

```typescript
function categoryInterpretation(category: string, label: string, delta: number, ivScore: number): string {
  const direction = delta > 0.5 ? 'rising' : delta < -0.5 ? 'subsiding' : 'stable';

  const catContext: Record<string, string> = {
    'geopolitical': 'Watch for gap risk on overnight holds.',
    'political': 'Policy headlines may whipsaw intraday — trade smaller.',
    'monetary-policy': 'Bonds leading — check /ZN before equity entries.',
    'earnings-corporate': 'Single-stock vol elevated — favor spreads.',
    'market-structure': 'Liquidity thinning — reduce size on breakouts.',
    'black-swan': 'Tail risk active — consider hedges or flat.',
  };

  const base = direction === 'rising'
    ? `${label} heat rising at ${ivScore.toFixed(1)} — momentum ${delta > 0 ? '+' : ''}${delta.toFixed(1)}.`
    : direction === 'subsiding'
      ? `${label} heat cooling — momentum ${delta.toFixed(1)}, uncertainty receding.`
      : `${label} heat steady at ${ivScore.toFixed(1)} — no directional shift.`;

  return `${base} ${catContext[category] ?? ''}`;
}
```

Replace the existing ternary block at ~577-583 with:
```tsx
<p className="text-[10px] text-[var(--fintheon-muted)]/50 leading-relaxed">
  {categoryInterpretation(cs.category, label, cs.delta, cs.ivScore)}
</p>
```

---

## Verification

```bash
# Type-check frontend
cd frontend && npx tsc --noEmit

# Build frontend
bun run build

# Verify old KPI labels are gone
grep -n "Composite IV\|Regime Shift\|Model Confidence" frontend/components/narrative/Sanctum.tsx
# ^ Should return 0 matches (replaced with Market Heat, Regime Risk, Signal Strength)

# Verify new labels exist
grep -n "Market Heat\|Regime Risk\|Signal Strength" frontend/components/narrative/Sanctum.tsx
# ^ Should return matches
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S4-T3: Rewrote KPI labels to trading lingo (Market Heat, Regime Risk, Signal Strength) with interpretive sub-text. Enhanced briefing display with structured sections and severity indicators. Updated category score interpretation with trading-specific context per risk sector.', files: ['frontend/components/narrative/Sanctum.tsx', 'frontend/components/narrative/SanctumBriefing.tsx', 'frontend/components/narrative/SanctumEconIntel.tsx'] }
```

---

## DO NOT

- Do NOT touch backend files — that's T2 scope
- Do NOT modify `SanctumRiskAssessment.tsx` — that's T4 scope
- Do NOT modify `SanctumChart.tsx`, `SanctumHeader.tsx`, `SanctumTheses.tsx`, `SanctumNarratives.tsx` — out of scope
- Do NOT add new API calls or fetch logic — this track is purely UI/copy changes
- Do NOT change the data shape or types — T2 handles type widening
- Do NOT remove the idle/loading states — they were intentionally restructured in commit 08d325d
