# S3-T4: Scored Items in Econ + Risk Panels

**Sprint:** S3 (Sanctum Intelligence Overhaul)
**Track:** T4 — Frontend (Econ Intel + Risk Assessment)
**Dependencies:** T1 must be complete (expanded RiskFlowCatalyst type with econ_data, sub_scores, etc.)

---

## Objective
Wire the full scored RiskFlow data into Sanctum's Econ Intelligence (Page 1) and Risk Assessment (Page 2) panels. Replace the fragile hardcoded-ticker matching with real econ print data from scored items. Enrich the Risk Assessment with sub-scores, agent notes, and risk type badges.

---

## Files to Read First
- `frontend/components/narrative/SanctumEconIntel.tsx` — current econ cards (423 lines). Key: lines 9-18 (hardcoded tickers), 236-276 (data fetch)
- `frontend/components/narrative/SanctumRiskAssessment.tsx` — current risk headlines (106 lines)
- `frontend/components/narrative/Sanctum.tsx` — how these components receive props (lines 267, 319-320)
- `frontend/types/mirofish.ts` — RiskFlowCatalyst (AFTER T1), EconCardData, SimulationContext
- `frontend/components/feed/RiskFlowDetailCard.tsx` — design reference for how scored items are displayed elsewhere in the app
- `frontend/components/feed/DetailFooter.tsx` — sub-score breakdown display pattern

---

## Files to Modify

### 1. `frontend/components/narrative/Sanctum.tsx` — Props Threading

**What:** Pass `riskflowItems` to SanctumEconIntel so it can extract econ prints from scored items.

Find line 267:
```tsx
<SanctumEconIntel expanded={preset === 'econ-watch'} context={displayContext} categoryScores={data?.categoryScores} />
```

Replace with:
```tsx
<SanctumEconIntel
  expanded={preset === 'econ-watch'}
  context={displayContext}
  categoryScores={data?.categoryScores}
  riskflowItems={riskflowItems}
/>
```

### 2. `frontend/components/narrative/SanctumEconIntel.tsx` — Econ Print Integration

**What:** Accept `riskflowItems` prop and use their `econ_data` to populate econ cards with real print data. Keep the hardcoded tickers as the card structure, but merge in actual data from scored items.

**Step A — Update the props interface** (line ~225-229):
```typescript
interface SanctumEconIntelProps {
  expanded?: boolean;
  context?: SimulationContext | null;
  categoryScores?: MiroFishCategoryScore[];
  riskflowItems?: RiskFlowCatalyst[];  // NEW
}
```

Update the function signature:
```typescript
export function SanctumEconIntel({ expanded, context, categoryScores, riskflowItems }: SanctumEconIntelProps) {
```

**Step B — Add econ print extraction from riskflowItems.** Add this after the `cards` state initialization (after line 233):

```typescript
// Extract econ prints from scored RiskFlow items that have econ_data
useEffect(() => {
  if (!riskflowItems?.length) return;

  const econItems = riskflowItems.filter(item => item.econ_data?.actual != null);
  if (econItems.length === 0) return;

  setCards(prev => prev.map(card => {
    // Find a scored item whose title matches this ticker
    const match = econItems.find(item => {
      const title = item.title.toUpperCase();
      const ticker = card.ticker.toUpperCase();
      // Match: "CPI Actual 3.2..." or "Consumer Price Index..."
      return title.includes(ticker) || title.includes(card.name.toUpperCase())
        || (ticker === 'CPI' && title.includes('CONSUMER PRICE'))
        || (ticker === 'PPI' && title.includes('PRODUCER PRICE'))
        || (ticker === 'PCE' && (title.includes('PERSONAL CONSUMPTION') || title.includes('PCE')))
        || (ticker === 'GDP' && title.includes('GROSS DOMESTIC'))
        || (ticker === 'PMI' && (title.includes('PURCHASING') || title.includes('ISM')))
        || (ticker === 'FOMC' && (title.includes('FOMC') || title.includes('FED RATE') || title.includes('FEDERAL RESERVE')))
        || (ticker === 'PI' && title.includes('PERSONAL INCOME'))
        || (ticker === 'CUTS' && (title.includes('RATE CUT') || title.includes('FED FUND')));
    });

    if (!match?.econ_data) return card;

    const ed = match.econ_data;
    return {
      ...card,
      lastPrint: {
        id: match.id,
        eventName: card.name,
        date: match.created_at?.slice(0, 10) ?? '',
        actual: ed.actual ?? 0,
        forecast: ed.forecast ?? 0,
        previous: ed.previous ?? 0,
        surprise: ed.surprisePercent ?? 0,
        direction: ed.beatMiss ?? 'inline',
      } satisfies EconPrint,
      agentConsensus: ed.beatMiss ?? undefined,
      agentConfidence: match.iv_score ? Math.min(match.iv_score / 10, 1) : undefined,
    };
  }));
}, [riskflowItems]);
```

Import `RiskFlowCatalyst` from the types if not already imported:
```typescript
import type { EconCardData, SimulationContext, MiroFishCategoryScore, RiskFlowCatalyst, EconPrint } from '../../types/mirofish';
```

**Step C — Add an "Econ Prints" summary row above the risk category cards.** Insert BEFORE the existing risk category cards section (before line 281):

```tsx
{/* Recent Econ Prints from scored RiskFlow items */}
{riskflowItems && riskflowItems.filter(i => i.econ_data?.actual != null).length > 0 && (
  <div className="mb-4">
    <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
      Recent Economic Prints
    </div>
    <div className="flex flex-col gap-1.5">
      {riskflowItems
        .filter(i => i.econ_data?.actual != null)
        .slice(0, 6)
        .map(item => {
          const ed = item.econ_data!;
          const beatMissColor = ed.beatMiss === 'beat' ? 'var(--fintheon-low)' :
            ed.beatMiss === 'miss' ? 'var(--fintheon-severe)' : 'var(--fintheon-neutral-severe)';
          return (
            <div key={item.id} className="flex items-center gap-3 rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/60 px-3 py-2">
              <div
                className="w-1.5 h-6 rounded-full shrink-0"
                style={{ backgroundColor: beatMissColor }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-[var(--fintheon-text)]/80 font-medium truncate block">
                  {item.title}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono text-[9px]">
                <span className="text-[var(--fintheon-text)]">{ed.actual}</span>
                <span className="text-[var(--fintheon-muted)]/50">vs {ed.forecast ?? '—'}</span>
                <span className="font-bold px-1 py-0.5 rounded" style={{
                  color: beatMissColor,
                  backgroundColor: `${beatMissColor}15`,
                }}>
                  {ed.beatMiss?.toUpperCase() ?? '—'}
                </span>
                {ed.surprisePercent != null && (
                  <span className="text-[var(--fintheon-muted)]/50">
                    {ed.surprisePercent > 0 ? '+' : ''}{ed.surprisePercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  </div>
)}
```

### 3. `frontend/components/narrative/SanctumRiskAssessment.tsx` — Rich Scored Item Cards

**What:** Replace the minimal headline list with richer cards showing IV score breakdown, risk type badge, sentiment direction, implied points, and agent note preview.

**Full rewrite of the component:**

```tsx
// [claude-code 2026-03-27] S3-T4: Rich scored item cards with sub-scores, agent notes, risk type
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RiskFlowCatalyst, MiroFishCategoryScore } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, ivHeatColor } from '../../types/mirofish';

interface SanctumRiskAssessmentProps {
  riskflowItems: RiskFlowCatalyst[];
  categoryScores?: MiroFishCategoryScore[];
}

const RISK_CATEGORIES = ['geopolitical', 'political'] as const;

function sentimentColor(s: string): string {
  if (s === 'bearish') return 'var(--fintheon-severe)';
  if (s === 'bullish') return 'var(--fintheon-low)';
  return 'var(--fintheon-neutral-severe)';
}

function macroLevelLabel(level: number): string {
  if (level >= 4) return 'CRITICAL';
  if (level >= 3) return 'HIGH';
  return 'MEDIUM';
}

export function SanctumRiskAssessment({ riskflowItems, categoryScores }: SanctumRiskAssessmentProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const geoItems = riskflowItems.filter(item => {
    const cat = (item.category ?? item.risk_type ?? '').toLowerCase();
    return cat.includes('geopolitical') || cat.includes('political') || cat.includes('fiscal')
      || item.title.toLowerCase().match(/tariff|sanction|war|election|regulation|congress|trade.*deal/);
  }).slice(0, 8);

  const relevantScores = (categoryScores ?? []).filter(cs =>
    RISK_CATEGORIES.includes(cs.category as typeof RISK_CATEGORIES[number]),
  );

  if (geoItems.length === 0 && relevantScores.length === 0) {
    return (
      <div className="text-[10px] text-[var(--fintheon-muted)]/30 italic text-center py-4">
        No geopolitical or fiscal risk signals in current window
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category score headers */}
      {relevantScores.length > 0 && (
        <div className="flex gap-3">
          {relevantScores.map(cs => (
            <div
              key={cs.category}
              className="flex items-center gap-3 rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-2"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ivHeatColor(cs.ivScore) }} />
              <span className="text-[10px] font-mono text-[var(--fintheon-text)]/80 uppercase tracking-wider">
                {RISK_CATEGORY_LABELS[cs.category]}
              </span>
              <span className="text-lg font-mono font-bold" style={{ color: ivHeatColor(cs.ivScore) }}>
                {cs.ivScore.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scored headline cards */}
      <div className="flex flex-col gap-1.5">
        {geoItems.map(item => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded border bg-[var(--fintheon-bg)]/60 transition-all cursor-pointer ${
                isExpanded ? 'border-[var(--fintheon-accent)]/25' : 'border-[var(--fintheon-border)]/10 hover:border-[var(--fintheon-border)]/20'
              }`}
              onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div
                  className="w-1.5 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: sentimentColor(item.sentiment) }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[var(--fintheon-text)]/80 font-medium truncate block">
                    {item.title}
                  </span>
                  {item.summary && !isExpanded && (
                    <span className="text-[9px] text-[var(--fintheon-muted)]/40 truncate block">
                      {item.summary}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.risk_type && (
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/70">
                      {item.risk_type}
                    </span>
                  )}
                  <span className="text-[8px] font-mono font-bold" style={{ color: sentimentColor(item.sentiment) }}>
                    {item.sentiment.toUpperCase()}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50">
                    IV {item.iv_score.toFixed(0)}
                  </span>
                  <span className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded ${
                    item.macro_level >= 4 ? 'bg-[var(--fintheon-severe)]/15 text-[var(--fintheon-severe)]' :
                    item.macro_level >= 3 ? 'bg-[var(--fintheon-neutral-severe)]/15 text-[var(--fintheon-neutral-severe)]' :
                    'bg-[var(--fintheon-border)]/10 text-[var(--fintheon-muted)]/50'
                  }`}>
                    {macroLevelLabel(item.macro_level)}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-[var(--fintheon-muted)]/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded detail */}
              <div
                className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
                style={{ maxHeight: isExpanded ? '300px' : '0px', opacity: isExpanded ? 1 : 0 }}
              >
                <div className="border-t border-[var(--fintheon-border)]/10 px-3 py-2 flex flex-col gap-2">
                  {/* Summary */}
                  {item.summary && (
                    <p className="text-[10px] text-[var(--fintheon-text)]/60 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                  {/* Econ data (if this is an econ print) */}
                  {item.econ_data?.actual != null && (
                    <div className="grid grid-cols-4 gap-2 text-[9px] font-mono">
                      <div>
                        <span className="text-[var(--fintheon-muted)]/40 block text-[7px] uppercase">Actual</span>
                        <span className="text-[var(--fintheon-text)]">{item.econ_data.actual}</span>
                      </div>
                      <div>
                        <span className="text-[var(--fintheon-muted)]/40 block text-[7px] uppercase">Forecast</span>
                        <span className="text-[var(--fintheon-text)]/70">{item.econ_data.forecast ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--fintheon-muted)]/40 block text-[7px] uppercase">Previous</span>
                        <span className="text-[var(--fintheon-text)]/50">{item.econ_data.previous ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--fintheon-muted)]/40 block text-[7px] uppercase">Surprise</span>
                        <span style={{ color: item.econ_data.beatMiss === 'beat' ? 'var(--fintheon-low)' : item.econ_data.beatMiss === 'miss' ? 'var(--fintheon-severe)' : 'var(--fintheon-neutral-severe)' }}>
                          {item.econ_data.surprisePercent != null ? `${item.econ_data.surprisePercent > 0 ? '+' : ''}${item.econ_data.surprisePercent.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sub-scores (scoring breakdown) */}
                  {item.sub_scores && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-mono text-[var(--fintheon-muted)]/50">
                      <span>E:{item.sub_scores.eventWeight.toFixed(1)}</span>
                      <span>T:{item.sub_scores.timing.toFixed(1)}</span>
                      <span>D:{item.sub_scores.deviation.toFixed(1)}</span>
                      <span>M:{item.sub_scores.momentum.toFixed(1)}</span>
                      <span>VIX:{item.sub_scores.vixMultiplier.toFixed(2)}x</span>
                      {item.sub_scores.regimeMultiplier != null && (
                        <span>Regime:{item.sub_scores.regimeMultiplier.toFixed(2)}x</span>
                      )}
                      {item.sub_scores.speaker && (
                        <span className="text-[var(--fintheon-accent)]/60">
                          {item.sub_scores.speaker} ({item.sub_scores.commentatorMultiplier?.toFixed(2) ?? '1.00'}x)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Implied points */}
                  {item.price_brain_score?.impliedPoints != null && (
                    <div className="flex items-center gap-2 text-[9px] font-mono">
                      <span className="text-[var(--fintheon-muted)]/40">Implied:</span>
                      <span style={{ color: sentimentColor(item.price_brain_score.sentiment.toLowerCase()) }}>
                        {item.price_brain_score.impliedPoints > 0 ? '+' : ''}{item.price_brain_score.impliedPoints} pts
                      </span>
                      <span className="text-[var(--fintheon-muted)]/30">
                        ({item.price_brain_score.sentiment} / {item.price_brain_score.classification})
                      </span>
                    </div>
                  )}

                  {/* Agent note */}
                  {item.agent_note && (
                    <div className="border-t border-[var(--fintheon-border)]/5 pt-2">
                      <span className="text-[7px] text-[var(--fintheon-accent)]/40 uppercase tracking-wider block mb-0.5">Oracle</span>
                      <p className="text-[9px] text-[var(--fintheon-text)]/50 leading-relaxed">
                        {item.agent_note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Key changes from current:**
- Cards are now expandable (click to toggle detail panel)
- Expanded view shows: summary, econ data (actual/forecast/previous/surprise), sub-score breakdown, implied points, agent note
- Risk type badge added next to sentiment
- Uses same `risk_type` field for category filtering (falls back to `category` for backward compat)

---

## Key Rules
- Import `RiskFlowCatalyst` from `../../types/mirofish` — this has the expanded fields from T1
- Keep all new field access optional-chained (e.g., `item.econ_data?.actual`) — old items won't have these fields
- The econ print matching in SanctumEconIntel is additive — it KEEPS the existing `/api/data/econ-events` fetch as primary, and SUPPLEMENTS with scored RiskFlow econ data
- SanctumRiskAssessment keeps backward compat — the `risk_type` filter falls back to `category` if `risk_type` isn't present
- `ChevronDown` import from lucide-react is needed for the expandable cards

---

## DO NOT
- Modify mirofish-types.ts or mirofish-context.ts (that's T1)
- Modify mirofish-briefing.ts or mirofish-service.ts (that's T2)
- Modify the KPI row in Sanctum.tsx or SanctumBriefing.tsx (that's T3)
- Modify NarrativeFlow.tsx (that's T1)
- Change the data flow or API endpoints — only update what's RENDERED

---

## Verification
```bash
cd /Users/tifos/Documents/Codebases/fintheon
npx tsc --noEmit  # Zero type errors
bun run build     # Clean Vite build
# Visual check — Econ Intel page:
#   - "Recent Economic Prints" section above risk categories (shows beat/miss/surprise data)
#   - Econ cards should show actual/forecast/previous from scored items (not just "Awaiting data...")
# Visual check — Risk Assessment (Page 2):
#   - Cards should be expandable
#   - Expanded cards show sub-scores, agent notes, econ data, implied points
#   - Risk type badges visible (Macro, Geopolitical, etc.)
```

---

## Changelog Entry
```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S3-T4: Wired scored RiskFlow econ_data into Sanctum econ cards. Added Recent Economic Prints section with beat/miss badges. Rich expandable Risk Assessment cards with sub-scores, agent notes, implied points, risk type badges.', files: ['frontend/components/narrative/Sanctum.tsx', 'frontend/components/narrative/SanctumEconIntel.tsx', 'frontend/components/narrative/SanctumRiskAssessment.tsx'] }
```
