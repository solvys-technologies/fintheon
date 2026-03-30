# S4-T4: Rich Risk Assessment + Scored Items Display

**Sprint:** S4 — Sanctum Intelligence Overhaul
**Track:** T4 (Frontend — Risk & Narratives Page)
**Depends On:** T2 (widened RiskFlowCatalyst type) — but can code against planned interface now
**Parallel With:** T2 (backend), T3 (frontend Command Center)

---

## Context

The Sanctum Risk Assessment section (Page 2, "Geopolitical & Fiscal Risk" panel) currently shows a thin list of RiskFlow headlines with just headline text, sentiment badge, IV score, and macro level. The data is filtered to geopolitical/political items only.

After T2 ships, `RiskFlowCatalyst` will include `sub_scores`, `econ_data`, `risk_type`, `agent_note`, and `price_brain_score`. This track upgrades the display to use that rich data — showing scoring breakdowns, agent notes, econ print data, and better categorization using the `risk_type` field.

---

## Files to Read First

- `frontend/components/narrative/SanctumRiskAssessment.tsx` — current 106-line component
- `frontend/components/narrative/Sanctum.tsx` — where SanctumRiskAssessment is rendered (~lines 313-326)
- `frontend/types/mirofish.ts` — `RiskFlowCatalyst` type (will be widened by T2)
- `frontend/components/feed/DetailFooter.tsx` — reference for how sub-scores are displayed in RiskFlow cards
- `frontend/components/feed/RiskFlowDetailCard.tsx` — reference for agent note display pattern

---

## Planned RiskFlowCatalyst Type (T2 adds these fields)

Code against this interface — T2 will update the actual type definition:

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
  // ── New fields (all optional, may be null) ──
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

## Task 1: Rewrite SanctumRiskAssessment with Rich Cards

**File:** `frontend/components/narrative/SanctumRiskAssessment.tsx`

Complete rewrite. The new component should:

1. **Filter using `risk_type`** instead of keyword matching — if `risk_type` exists, use it; fall back to keyword matching for items without `risk_type`
2. **Show ALL risk types** (not just geo/political) — group items by `risk_type` with section headers
3. **Expand on click** to show agent note, sub-scores, econ data
4. **Keep it under 250 lines** — extract sub-components if needed

### Updated Filter Logic

Replace the current keyword-based filter:

```typescript
// BEFORE: keyword matching on title
const geoItems = riskflowItems.filter(item => {
  const cat = item.category?.toLowerCase() ?? '';
  return cat.includes('geopolitical') || ...
}).slice(0, 8);
```

With `risk_type`-aware grouping:

```typescript
// Group by risk_type, fall back to keyword classification
function classifyItem(item: RiskFlowCatalyst): string {
  if (item.risk_type) return item.risk_type;
  const text = (item.title + ' ' + (item.category ?? '')).toLowerCase();
  if (/tariff|sanction|war|military|conflict/.test(text)) return 'Geopolitical';
  if (/election|regulation|congress|legislation/.test(text)) return 'Political';
  if (/fed|fomc|rate|inflation|cpi|ppi/.test(text)) return 'Macro';
  if (/earnings|eps|revenue|guidance/.test(text)) return 'Earnings';
  return 'General';
}

const grouped = new Map<string, RiskFlowCatalyst[]>();
for (const item of riskflowItems.slice(0, 20)) {
  const type = classifyItem(item);
  if (!grouped.has(type)) grouped.set(type, []);
  grouped.get(type)!.push(item);
}
```

### Rich Item Card

Each item should be expandable (click to toggle). Collapsed state shows what it shows now. Expanded state adds:

```tsx
function RiskItem({ item, isExpanded, onToggle }: { item: RiskFlowCatalyst; isExpanded: boolean; onToggle: () => void }) {
  const dirColor = item.sentiment === 'bearish' ? 'var(--fintheon-severe)'
    : item.sentiment === 'bullish' ? 'var(--fintheon-low)'
    : 'var(--fintheon-neutral-severe)';

  return (
    <div
      className="flex flex-col rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/60 transition-all cursor-pointer"
      onClick={onToggle}
    >
      {/* Collapsed row — same as current */}
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: dirColor }} />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-[var(--fintheon-text)]/80 font-medium truncate block">{item.title}</span>
          {item.summary && (
            <span className="text-[9px] text-[var(--fintheon-muted)]/40 truncate block">{item.summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.price_brain_score?.impliedPoints != null && (
            <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50">
              {item.price_brain_score.impliedPoints > 0 ? '+' : ''}{item.price_brain_score.impliedPoints}pts
            </span>
          )}
          <span className="text-[8px] font-mono font-bold" style={{ color: dirColor }}>
            {item.sentiment.toUpperCase()}
          </span>
          <span className="text-[8px] font-mono" style={{ color: ivHeatColor(item.iv_score) }}>
            {item.iv_score.toFixed(1)}
          </span>
          <ChevronDown className={`w-3 h-3 text-[var(--fintheon-muted)]/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded detail */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300"
        style={{ maxHeight: isExpanded ? '400px' : '0px', opacity: isExpanded ? 1 : 0 }}
      >
        <div className="border-t border-[var(--fintheon-border)]/10 px-3 py-2.5 flex flex-col gap-2">

          {/* Agent Note */}
          {item.agent_note && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1">Agent Note</span>
              <p className="text-[10px] text-[var(--fintheon-text)]/60 leading-relaxed">{item.agent_note}</p>
            </div>
          )}

          {/* Econ Data (if this is an econ print) */}
          {item.econ_data && (
            <div className="grid grid-cols-4 gap-2">
              {item.econ_data.actual != null && (
                <div>
                  <span className="text-[7px] text-[var(--fintheon-muted)]/40 uppercase block">Actual</span>
                  <span className="text-[10px] font-mono text-[var(--fintheon-text)]">{item.econ_data.actual}</span>
                </div>
              )}
              {item.econ_data.forecast != null && (
                <div>
                  <span className="text-[7px] text-[var(--fintheon-muted)]/40 uppercase block">Forecast</span>
                  <span className="text-[10px] font-mono text-[var(--fintheon-text)]/70">{item.econ_data.forecast}</span>
                </div>
              )}
              {item.econ_data.previous != null && (
                <div>
                  <span className="text-[7px] text-[var(--fintheon-muted)]/40 uppercase block">Previous</span>
                  <span className="text-[10px] font-mono text-[var(--fintheon-text)]/50">{item.econ_data.previous}</span>
                </div>
              )}
              {item.econ_data.beatMiss && (
                <div>
                  <span className="text-[7px] text-[var(--fintheon-muted)]/40 uppercase block">Result</span>
                  <span className="text-[10px] font-mono font-bold" style={{
                    color: item.econ_data.beatMiss === 'beat' ? 'var(--fintheon-low)'
                      : item.econ_data.beatMiss === 'miss' ? 'var(--fintheon-severe)'
                      : 'var(--fintheon-neutral-severe)'
                  }}>
                    {item.econ_data.beatMiss.toUpperCase()}
                    {item.econ_data.surprisePercent != null && ` ${item.econ_data.surprisePercent > 0 ? '+' : ''}${item.econ_data.surprisePercent.toFixed(1)}%`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sub-Score Breakdown */}
          {item.sub_scores && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1">Score Breakdown</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-mono text-[var(--fintheon-muted)]/50">
                {item.sub_scores.eventWeight != null && <span>E:{item.sub_scores.eventWeight.toFixed(1)}</span>}
                {item.sub_scores.timing != null && <span>T:{item.sub_scores.timing.toFixed(1)}</span>}
                {item.sub_scores.deviation != null && <span>D:{item.sub_scores.deviation.toFixed(1)}</span>}
                {item.sub_scores.momentum != null && <span>M:{item.sub_scores.momentum.toFixed(1)}</span>}
                {item.sub_scores.vixMultiplier != null && item.sub_scores.vixMultiplier !== 1 && (
                  <span className="text-[var(--fintheon-accent)]">VIX:{item.sub_scores.vixMultiplier.toFixed(2)}x</span>
                )}
                {item.sub_scores.regimeName && (
                  <span>{item.sub_scores.regimeName}{item.sub_scores.regimeMultiplier != null && item.sub_scores.regimeMultiplier !== 1 ? ` (${item.sub_scores.regimeMultiplier.toFixed(2)}x)` : ''}</span>
                )}
                {item.sub_scores.speaker && (
                  <span className="text-[var(--fintheon-accent)]/60">{item.sub_scores.speaker}{item.sub_scores.commentatorMultiplier != null && item.sub_scores.commentatorMultiplier !== 1 ? ` (${item.sub_scores.commentatorMultiplier.toFixed(2)}x)` : ''}</span>
                )}
              </div>
            </div>
          )}

          {/* PriceBrain direction */}
          {item.price_brain_score && (
            <div className="flex items-center gap-3 text-[9px] font-mono text-[var(--fintheon-muted)]/50">
              {item.price_brain_score.sentiment && <span>Bias: {item.price_brain_score.sentiment}</span>}
              {item.price_brain_score.classification && <span>{item.price_brain_score.classification}</span>}
              {item.price_brain_score.instrument && <span>{item.price_brain_score.instrument}</span>}
            </div>
          )}

          {/* Timestamp */}
          <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/25">
            {new Date(item.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### Updated Main Component

```tsx
export function SanctumRiskAssessment({ riskflowItems, categoryScores }: SanctumRiskAssessmentProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by risk type
  const grouped = new Map<string, RiskFlowCatalyst[]>();
  for (const item of riskflowItems.slice(0, 20)) {
    const type = classifyItem(item);
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(item);
  }

  // ... category score headers (keep existing)

  // Render grouped sections
  return (
    <div className="flex flex-col gap-3">
      {/* Category scores — keep existing display */}
      {relevantScores.length > 0 && (/* ... existing code ... */)}

      {/* Grouped risk items */}
      {[...grouped.entries()].map(([type, items]) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[8px] text-[var(--fintheon-muted)]/40 font-mono uppercase tracking-wider">{type}</span>
            <span className="text-[8px] text-[var(--fintheon-muted)]/25 font-mono">({items.length})</span>
            <div className="flex-1 h-px bg-[var(--fintheon-border)]/5" />
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map(item => (
              <RiskItem
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(prev => prev === item.id ? null : item.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Imports Needed

Add to the imports:
```typescript
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
```

---

## Task 2: Update Panel Title in Sanctum.tsx

**File:** `frontend/components/narrative/Sanctum.tsx`

The panel title at ~line 316 says "Geopolitical & Fiscal Risk". Since we now show all risk types, update:

```tsx
// BEFORE:
<span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Geopolitical & Fiscal Risk</span>

// AFTER:
<span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">Live Risk Signals</span>
```

---

## Verification

```bash
# Type-check frontend
cd frontend && npx tsc --noEmit

# Build
bun run build

# Verify component renders grouped items
grep -n "classifyItem\|risk_type\|grouped" frontend/components/narrative/SanctumRiskAssessment.tsx

# Verify no keyword-only filtering remains as the primary path
grep -n "cat.includes.*geopolitical\|title.toLowerCase().match" frontend/components/narrative/SanctumRiskAssessment.tsx
# ^ Should be inside fallback only, not the primary filter
```

---

## Changelog Entry

```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S4-T4: Upgraded SanctumRiskAssessment with rich scored item display — expandable cards showing agent notes, econ data, sub-score breakdowns, PriceBrain direction. Grouped by risk_type with section headers. Renamed panel to Live Risk Signals.', files: ['frontend/components/narrative/SanctumRiskAssessment.tsx', 'frontend/components/narrative/Sanctum.tsx'] }
```

---

## DO NOT

- Do NOT touch backend files — T2 scope
- Do NOT modify `SanctumEconIntel.tsx` — T3 scope
- Do NOT modify the KPI row or briefing display in Sanctum.tsx — T3 scope
- Do NOT change the panel title "Geopolitical & Fiscal Risk" to anything other than "Live Risk Signals" (already discussed)
- Do NOT add new API endpoints or fetch calls — the data is already passed via props
- Do NOT change how `riskflowItems` is fetched — NarrativeFlow passes it through from context
