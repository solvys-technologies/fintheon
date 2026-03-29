// [claude-code 2026-03-28] S4-T4: Rich scored item display — expandable cards with agent notes,
// econ data, sub-score breakdowns, PriceBrain direction. Grouped by risk_type with section headers.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RiskFlowCatalyst, MiroSharkCategoryScore } from '../../types/miroshark';
import { RISK_CATEGORY_LABELS, ivHeatColor } from '../../types/miroshark';

interface SanctumRiskAssessmentProps {
  riskflowItems: RiskFlowCatalyst[];
  categoryScores?: MiroSharkCategoryScore[];
}

const RISK_CATEGORIES = ['geopolitical', 'political'] as const;

/** Classify item by risk_type, falling back to keyword matching */
function classifyItem(item: RiskFlowCatalyst): string {
  if (item.risk_type) return item.risk_type;
  const text = (item.title + ' ' + (item.category ?? '')).toLowerCase();
  if (/tariff|sanction|war|military|conflict/.test(text)) return 'Geopolitical';
  if (/election|regulation|congress|legislation/.test(text)) return 'Political';
  if (/fed|fomc|rate|inflation|cpi|ppi/.test(text)) return 'Macro';
  if (/earnings|eps|revenue|guidance/.test(text)) return 'Earnings';
  return 'General';
}

function sentimentColor(s: string): string {
  if (s === 'bearish') return 'var(--fintheon-severe)';
  if (s === 'bullish') return 'var(--fintheon-low)';
  return 'var(--fintheon-neutral-severe)';
}

function fmt(n: number | undefined): string {
  if (n == null) return '—';
  return n.toFixed(n >= 10 ? 0 : n >= 1 ? 1 : 2);
}

// ── Expandable Risk Item ─────────────────────────────────────────────────────

function RiskItem({ item, isExpanded, onToggle }: { item: RiskFlowCatalyst; isExpanded: boolean; onToggle: () => void }) {
  const dirColor = sentimentColor(item.sentiment);

  return (
    <div
      className="flex flex-col rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/60 transition-all cursor-pointer"
      onClick={onToggle}
    >
      {/* Collapsed row */}
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

          {/* Econ Data */}
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
                {item.sub_scores.eventWeight != null && <span>E:{fmt(item.sub_scores.eventWeight)}</span>}
                {item.sub_scores.timing != null && <span>T:{fmt(item.sub_scores.timing)}</span>}
                {item.sub_scores.deviation != null && <span>D:{fmt(item.sub_scores.deviation)}</span>}
                {item.sub_scores.momentum != null && <span>M:{fmt(item.sub_scores.momentum)}</span>}
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

// ── Main Component ───────────────────────────────────────────────────────────

export function SanctumRiskAssessment({ riskflowItems, categoryScores }: SanctumRiskAssessmentProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by risk type
  const grouped = new Map<string, RiskFlowCatalyst[]>();
  for (const item of riskflowItems.slice(0, 20)) {
    const type = classifyItem(item);
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(item);
  }

  const relevantScores = (categoryScores ?? []).filter(cs =>
    RISK_CATEGORIES.includes(cs.category as typeof RISK_CATEGORIES[number]),
  );

  if (grouped.size === 0 && relevantScores.length === 0) {
    return (
      <div className="text-[10px] text-[var(--fintheon-muted)]/30 italic text-center py-4">
        No risk signals in current window
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
