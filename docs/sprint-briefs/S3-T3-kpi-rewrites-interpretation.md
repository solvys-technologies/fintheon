# S3-T3: Frontend KPI Rewrites + Interpretation Layer

**Sprint:** S3 (Sanctum Intelligence Overhaul)
**Track:** T3 — Frontend (Command Center)
**Dependencies:** T1 must be complete (expanded types)

---

## Objective
Replace the scoring-engine jargon in Sanctum's Command Center (Page 0) with trader-friendly labels and interpretive sub-text. Update the briefing panel to better render the now-richer AI-generated briefing content.

---

## Files to Read First
- `frontend/components/narrative/Sanctum.tsx` — KPI row at lines 216-236, briefing at line 239
- `frontend/components/narrative/SanctumBriefing.tsx` — current briefing renderer (106 lines)
- `frontend/types/mirofish.ts` — SanctumData, MiroFishBriefing types (AFTER T1 expansion)

---

## Files to Modify

### 1. `frontend/components/narrative/Sanctum.tsx`

**What:** Rewrite the KPI row (lines 215-236) with trader-friendly labels, interpretive sub-text, and contextual coloring.

Replace the existing KPI row section (`{/* KPI Row: Core metrics — center justified */}`) with:

```tsx
{/* KPI Row: Core metrics — trader-friendly */}
<div className="shrink-0 flex justify-center">
  <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
    {/* Market Heat */}
    <div className="rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/40 px-5 py-3 flex items-center justify-between" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
      <div>
        <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">
          Market Heat
        </span>
        <span className="text-3xl font-bold text-[var(--fintheon-accent)]">
          {data.compositeIV.toFixed(1)}
        </span>
        <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">
          {data.compositeIV >= 8 ? 'Extreme risk pressure' :
           data.compositeIV >= 6 ? 'Elevated — caution warranted' :
           data.compositeIV >= 4 ? 'Moderate — normal conditions' :
           data.compositeIV >= 2 ? 'Low — risk-on environment' :
           'Calm — minimal catalysts'}
        </span>
      </div>
      <div className="w-10 h-10 rounded-full border-2 border-[var(--fintheon-accent)]/30 flex items-center justify-center">
        <Zap className="w-5 h-5 text-[var(--fintheon-accent)]" />
      </div>
    </div>

    {/* Regime Change Risk */}
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
      <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">
        Regime Change Risk
      </span>
      <span className={`text-2xl font-bold ${
        data.regimeShiftProbability >= 0.4 ? 'text-[var(--fintheon-severe)]' :
        data.regimeShiftProbability >= 0.25 ? 'text-[var(--fintheon-neutral-severe)]' :
        'text-[var(--fintheon-text)]'
      }`}>
        {(data.regimeShiftProbability * 100).toFixed(0)}%
      </span>
      <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">
        {data.regimeShiftProbability >= 0.4 ? 'Structural shift likely — adapt strategy' :
         data.regimeShiftProbability >= 0.25 ? 'Elevated — watch for breakout/breakdown' :
         data.regimeShiftProbability >= 0.1 ? 'Low — current trend intact' :
         'Stable regime — no change expected'}
      </span>
    </div>

    {/* Signal Strength */}
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-5 py-3" style={{ boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)' }}>
      <span className="text-[9px] text-[var(--fintheon-muted)]/50 uppercase tracking-wider block">
        Signal Strength
      </span>
      <span className={`text-2xl font-bold ${
        data.confidence >= 0.8 ? 'text-[var(--fintheon-low)]' :
        data.confidence >= 0.6 ? 'text-[var(--fintheon-text)]' :
        'text-[var(--fintheon-muted)]/60'
      }`}>
        {(data.confidence * 100).toFixed(0)}%
      </span>
      <span className="text-[8px] text-[var(--fintheon-muted)]/40 block mt-0.5">
        {data.confidence >= 0.8 ? 'High conviction — agents agree' :
         data.confidence >= 0.6 ? 'Moderate — mixed signals' :
         data.confidence >= 0.4 ? 'Low — conflicting reads' :
         'Very low — insufficient data'}
      </span>
    </div>
  </div>
</div>
```

**Key changes from current:**
- "Composite IV" → "Market Heat"
- "Regime Shift" → "Regime Change Risk"
- "Model Confidence" → "Signal Strength"
- Each KPI now has an interpretive sub-label explaining what the number means in plain trading terms
- Regime Change Risk and Signal Strength get conditional text coloring (red when dangerous, green when confident)

### 2. `frontend/components/narrative/SanctumBriefing.tsx`

**What:** Update the briefing header label and improve rendering for the richer AI-generated content.

**Change 1:** Replace "MiroFish Briefing" label (line 45-47):
```tsx
// OLD:
<span className="text-[10px] font-mono font-bold text-[var(--fintheon-accent)]/70 uppercase tracking-wider">
  MiroFish Briefing
</span>

// NEW:
<span className="text-[10px] font-mono font-bold text-[var(--fintheon-accent)]/70 uppercase tracking-wider">
  Sanctum Analysis
</span>
```

**Change 2:** Replace "Key Findings" header text (line 68-69):
```tsx
// OLD:
Key Findings

// NEW:
What Moved & What Matters
```

**Change 3:** Update the agent consensus footer (lines 98-100) to be more prominent since it's now an actionable recommendation:
```tsx
// OLD:
<div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono pt-1 border-t border-[var(--fintheon-border)]/5">
  {briefing.agentConsensus}
</div>

// NEW:
<div className="pt-2 border-t border-[var(--fintheon-border)]/10">
  <span className="text-[8px] text-[var(--fintheon-accent)]/50 uppercase tracking-wider font-mono block mb-1">
    Signal
  </span>
  <p className="text-[11px] text-[var(--fintheon-text)]/80 font-medium leading-relaxed">
    {briefing.agentConsensus}
  </p>
</div>
```

---

## Key Rules
- Solvys Gold palette: accent `#c79f4a`, bg `#050402`, text `#f0ead6` — all referenced via CSS vars, don't hardcode
- No gradients, no colored emojis
- Keep the same grid layout (3-col KPI row) — only change content/labels
- The `data` prop shape (SanctumData) is unchanged — we're just relabeling what's displayed
- Interpretive sub-text uses `text-[8px]` size to stay subtle — it's guidance, not the primary metric
- The briefing component keeps the same expand/collapse behavior — just better labels and emphasis

---

## DO NOT
- Modify SanctumEconIntel.tsx or SanctumRiskAssessment.tsx (that's T4)
- Modify any backend files (that's T1/T2)
- Change the SanctumData interface or any types
- Add new API calls or state
- Modify NarrativeFlow.tsx (that's T1)
- Change the chart, theses, or narratives sections — only KPI row and briefing panel

---

## Verification
```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit  # Zero type errors
bun run build     # Clean Vite build
# Visual: open Sanctum → Command Center page
#   - KPIs should show "Market Heat", "Regime Change Risk", "Signal Strength"
#   - Each KPI should have a small interpretive sub-label
#   - Briefing should say "Sanctum Analysis" not "MiroFish Briefing"
#   - Agent consensus section should be labeled "Signal" and look more prominent
```

---

## Changelog Entry
```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S3-T3: Replaced scoring-engine jargon with trader-friendly KPI labels (Market Heat, Regime Change Risk, Signal Strength) + interpretive sub-text. Updated briefing panel labels (Sanctum Analysis, What Moved & What Matters, Signal).', files: ['frontend/components/narrative/Sanctum.tsx', 'frontend/components/narrative/SanctumBriefing.tsx'] }
```
