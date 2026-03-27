// [claude-code 2026-03-27] Econ Intel — historical prints, scoring breakdown, MiroFish-ready aggregation
// [claude-code 2026-03-24] Econ Intel — 2-col grid, expandable cards with countdown + history + risk category sub-cards
import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarClock, ChevronDown, Activity, BarChart3 } from 'lucide-react';
import type { EconCardData, EconHistoryPrint, EconScoredItem, SimulationContext, MiroFishCategoryScore } from '../../types/mirofish';
import { RISK_CATEGORY_LABELS, ivHeatColor } from '../../types/mirofish';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ECON_TICKERS: EconCardData[] = [
  { name: 'Consumer Price Index', ticker: 'CPI' },
  { name: 'Producer Price Index', ticker: 'PPI' },
  { name: 'Personal Income', ticker: 'PI' },
  { name: 'Gross Domestic Product', ticker: 'GDP' },
  { name: 'Purchasing Mgrs Index', ticker: 'PMI' },
  { name: 'Personal Consumption', ticker: 'PCE' },
  { name: 'Fed Rate Decision', ticker: 'FOMC' },
  { name: 'Rate Cut Expectations', ticker: 'CUTS' },
];

const DIRECTION_CONFIG = {
  beat: { icon: TrendingUp, color: 'var(--fintheon-low)', label: 'BEAT' },
  miss: { icon: TrendingDown, color: 'var(--fintheon-severe)', label: 'MISS' },
  inline: { icon: Minus, color: 'var(--fintheon-neutral-severe)', label: 'INLINE' },
} as const;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'var(--fintheon-low)' : pct >= 50 ? 'var(--fintheon-neutral-severe)' : 'var(--fintheon-severe)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50 w-[28px] text-right">
        {pct}%
      </span>
    </div>
  );
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function countdownLabel(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d away`;
}

/** Compute beat/miss streak from history */
function computeStreak(history: EconHistoryPrint[]): { type: 'beat' | 'miss' | 'inline' | null; count: number } {
  if (history.length === 0) return { type: null, count: 0 };
  const first = history[0].direction;
  if (!first) return { type: null, count: 0 };
  let count = 0;
  for (const p of history) {
    if (p.direction === first) count++;
    else break;
  }
  return { type: first, count };
}

/** Sub-score bar for scoring breakdown */
function SubScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = ivHeatColor(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/50 w-[52px] truncate">{label}</span>
      <div className="flex-1 h-[4px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/60 w-[24px] text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function EconCard({
  data,
  expanded,
  onToggle,
  historyCache,
  onFetchHistory,
}: {
  data: EconCardData;
  expanded: boolean;
  onToggle: () => void;
  historyCache: Record<string, { prints: EconHistoryPrint[]; scored: EconScoredItem[] }>;
  onFetchHistory: (ticker: string) => void;
}) {
  const direction = data.agentConsensus ?? 'inline';
  const cfg = DIRECTION_CONFIG[direction];
  const Icon = cfg.icon;
  const hasAgent = data.agentConsensus != null;

  // Fetch history when expanding
  const prevExpanded = useRef(expanded);
  useEffect(() => {
    if (expanded && !prevExpanded.current && !historyCache[data.ticker]) {
      onFetchHistory(data.ticker);
    }
    prevExpanded.current = expanded;
  }, [expanded, data.ticker, historyCache, onFetchHistory]);

  const cached = historyCache[data.ticker];
  const history = data.printHistory ?? cached?.prints ?? [];
  const scoredItems = data.scoredItems ?? cached?.scored ?? [];
  const streak = computeStreak(history);

  // Show most recent scored item's sub-scores
  const latestScored = scoredItems[0];

  return (
    <div
      className={`flex flex-col rounded border bg-[var(--fintheon-surface)]/40 transition-all duration-300 cursor-pointer ${
        expanded
          ? 'border-[var(--fintheon-accent)]/30 shadow-[0_0_12px_rgba(199,159,74,0.15)]'
          : 'border-[var(--fintheon-border)]/15 hover:border-[var(--fintheon-accent)]/20'
      }`}
      onClick={onToggle}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[13px] font-mono font-bold text-[var(--fintheon-accent)]">
              {data.ticker}
            </span>
            <p className="text-[10px] text-[var(--fintheon-muted)]/50 mt-0.5">
              {data.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasAgent && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold"
                style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </div>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--fintheon-muted)]/30 transition-transform duration-300 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {/* Last print data */}
        {data.lastPrint ? (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">
                Actual
              </span>
              <span className="text-xs font-mono text-[var(--fintheon-text)]">
                {data.lastPrint.actual}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">
                Forecast
              </span>
              <span className="text-xs font-mono text-[var(--fintheon-text)]/70">
                {data.lastPrint.forecast}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">
                Previous
              </span>
              <span className="text-xs font-mono text-[var(--fintheon-text)]/50">
                {data.lastPrint.previous}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-[var(--fintheon-muted)]/30 italic mb-3">
            Awaiting data...
          </div>
        )}

        {/* Next print date */}
        {data.nextDate && (
          <div className="flex items-center gap-1.5 text-[9px] text-[var(--fintheon-muted)]/50 mb-2">
            <CalendarClock className="w-3 h-3" />
            <span className="font-mono">Next: {data.nextDate}</span>
          </div>
        )}

        {/* Agent confidence */}
        {data.agentConfidence != null && (
          <div>
            <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
              Agent Confidence
            </span>
            <ConfidenceBar value={data.agentConfidence} />
          </div>
        )}
      </div>

      {/* ── Expanded detail panel ── */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? '700px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="border-t border-[var(--fintheon-border)]/10 px-4 py-3 flex flex-col gap-3">
          {/* Countdown */}
          {data.nextDate && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60" />
                <span className="text-[10px] font-mono text-[var(--fintheon-text)]/80">
                  Next print: {data.nextDate}
                </span>
              </div>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: daysUntil(data.nextDate) <= 2 ? '#EF4444' : daysUntil(data.nextDate) <= 7 ? '#F59E0B' : '#34D399',
                  backgroundColor: daysUntil(data.nextDate) <= 2 ? '#EF444415' : daysUntil(data.nextDate) <= 7 ? '#F59E0B15' : '#34D39915',
                }}
              >
                {countdownLabel(data.nextDate)}
              </span>
            </div>
          )}

          {/* ── Historical Print Table ── */}
          {history.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  Print History ({history.length} prints)
                </span>
                {streak.type && streak.count > 1 && (
                  <span
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: DIRECTION_CONFIG[streak.type]?.color ?? '#F59E0B',
                      backgroundColor: `${DIRECTION_CONFIG[streak.type]?.color ?? '#F59E0B'}15`,
                    }}
                  >
                    {streak.count}x {streak.type.toUpperCase()} streak
                  </span>
                )}
              </div>
              <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/40 overflow-hidden">
                <div className="grid grid-cols-6 gap-0 text-[8px] font-mono text-[var(--fintheon-muted)]/40 uppercase tracking-wider px-3 py-1.5 border-b border-[var(--fintheon-border)]/5">
                  <span>Date</span><span>Actual</span><span>Forecast</span><span>Previous</span><span>Surprise</span><span>IV</span>
                </div>
                {history.map((p, i) => (
                  <div
                    key={p.id ?? i}
                    className={`grid grid-cols-6 gap-0 text-[10px] font-mono px-3 py-1.5 ${
                      i > 0 ? 'border-t border-[var(--fintheon-border)]/5' : ''
                    }`}
                  >
                    <span className="text-[var(--fintheon-muted)]/60">{p.date?.slice(5) ?? '—'}</span>
                    <span className="text-[var(--fintheon-text)]">{p.actual ?? '—'}</span>
                    <span className="text-[var(--fintheon-text)]/70">{p.forecast ?? '—'}</span>
                    <span className="text-[var(--fintheon-text)]/50">{p.previous ?? '—'}</span>
                    <span style={{ color: p.direction ? DIRECTION_CONFIG[p.direction]?.color ?? '#F59E0B' : 'var(--fintheon-muted)' }}>
                      {p.surprise != null ? (p.surprise > 0 ? '+' : '') + p.surprise.toFixed(2) + '%' : '—'}
                    </span>
                    <span style={{ color: p.ivScore != null ? ivHeatColor(p.ivScore) : 'var(--fintheon-muted)' }}>
                      {p.ivScore != null ? p.ivScore.toFixed(1) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : data.lastPrint ? (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">
                Recent Print History
              </span>
              <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/40 overflow-hidden">
                <div className="grid grid-cols-5 gap-0 text-[8px] font-mono text-[var(--fintheon-muted)]/40 uppercase tracking-wider px-3 py-1.5 border-b border-[var(--fintheon-border)]/5">
                  <span>Date</span><span>Actual</span><span>Forecast</span><span>Previous</span><span>Result</span>
                </div>
                <div className="grid grid-cols-5 gap-0 text-[10px] font-mono px-3 py-2">
                  <span className="text-[var(--fintheon-muted)]/60">{data.lastPrint.date?.slice(5) ?? '—'}</span>
                  <span className="text-[var(--fintheon-text)]">{data.lastPrint.actual}</span>
                  <span className="text-[var(--fintheon-text)]/70">{data.lastPrint.forecast}</span>
                  <span className="text-[var(--fintheon-text)]/50">{data.lastPrint.previous}</span>
                  <span style={{ color: DIRECTION_CONFIG[data.lastPrint.direction ?? 'inline']?.color ?? '#F59E0B' }}>
                    {data.lastPrint.surprise != null ? (data.lastPrint.surprise > 0 ? '+' : '') + data.lastPrint.surprise.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Scoring Breakdown (from most recent scored item) ── */}
          {latestScored && latestScored.subScores && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Activity className="w-3 h-3" />
                Scoring Engine Breakdown
              </span>
              <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-bg)]/40 px-3 py-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-[var(--fintheon-text)]/80">
                    IV: <span className="font-bold" style={{ color: ivHeatColor(latestScored.ivScore ?? 0) }}>
                      {latestScored.ivScore?.toFixed(1) ?? '—'}
                    </span>
                    /10
                  </span>
                  <div className="flex items-center gap-2">
                    {latestScored.macroLevel && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]">
                        L{latestScored.macroLevel}
                      </span>
                    )}
                    {latestScored.sentiment && (
                      <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/50">
                        {latestScored.sentiment}
                      </span>
                    )}
                  </div>
                </div>
                <SubScoreBar label="Event Wt" value={latestScored.subScores.eventWeight ?? 0} max={10} />
                <SubScoreBar label="Timing" value={latestScored.subScores.timing ?? 0} max={3} />
                <SubScoreBar label="Deviation" value={latestScored.subScores.deviation ?? 0} max={3} />
                <SubScoreBar label="Momentum" value={latestScored.subScores.momentum ?? 0} max={2} />
                <SubScoreBar label="VIX Ctx" value={latestScored.subScores.vixContext ?? 0} max={10} />
                {latestScored.subScores.vixMultiplier != null && latestScored.subScores.vixMultiplier !== 1 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/40">VIX Multiplier</span>
                    <span className="text-[9px] font-mono text-[var(--fintheon-accent)]">
                      {latestScored.subScores.vixMultiplier.toFixed(2)}x
                    </span>
                  </div>
                )}
                {latestScored.subScores.regimeName && (
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/40">Regime</span>
                    <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/60">
                      {latestScored.subScores.regimeName}
                      {latestScored.subScores.regimeMultiplier != null && latestScored.subScores.regimeMultiplier !== 1
                        ? ` (${latestScored.subScores.regimeMultiplier.toFixed(2)}x)`
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Scored Items Feed (related RiskFlow items) ── */}
          {scoredItems.length > 1 && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">
                Related Scored Items ({scoredItems.length})
              </span>
              <div className="flex flex-col gap-1">
                {scoredItems.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--fintheon-bg)]/30 border border-[var(--fintheon-border)]/5"
                  >
                    <span
                      className="text-[10px] font-mono font-bold w-[28px]"
                      style={{ color: ivHeatColor(s.ivScore ?? 0) }}
                    >
                      {s.ivScore?.toFixed(1) ?? '—'}
                    </span>
                    <span className="text-[9px] text-[var(--fintheon-text)]/60 truncate flex-1">
                      {s.headline}
                    </span>
                    {s.publishedAt && (
                      <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/30 flex-shrink-0">
                        {new Date(s.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent reasoning */}
          {hasAgent && data.agentConfidence != null && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1">
                Agent Reasoning
              </span>
              <p className="text-[10px] text-[var(--fintheon-muted)]/50 leading-relaxed">
                Model projects <span className="font-bold" style={{ color: cfg.color }}>{cfg.label}</span> with{' '}
                {Math.round((data.agentConfidence ?? 0) * 100)}% confidence based on recent macro signals and historical print patterns.
                {streak.type && streak.count > 1 && (
                  <> Current {streak.count}x {streak.type} streak suggests {
                    streak.type === 'beat' ? 'upward bias' : streak.type === 'miss' ? 'downward pressure' : 'range-bound action'
                  }.</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SanctumEconIntelProps {
  expanded?: boolean;
  context?: SimulationContext | null;
  categoryScores?: MiroFishCategoryScore[];
}

export function SanctumEconIntel({ expanded, context, categoryScores }: SanctumEconIntelProps) {
  const [cards, setCards] = useState<EconCardData[]>(ECON_TICKERS);
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, { prints: EconHistoryPrint[]; scored: EconScoredItem[] }>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchEconData() {
      try {
        const res = await fetch(`${API_BASE}/api/data/econ-calendar`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        // Merge fetched data with our ticker cards
        if (Array.isArray(data.events)) {
          setCards(prev =>
            prev.map(card => {
              const match = data.events.find(
                (e: { aiTicker?: string; name?: string }) =>
                  e.aiTicker === card.ticker ||
                  e.name?.toLowerCase().includes(card.ticker.toLowerCase())
              );
              if (!match) return card;
              return {
                ...card,
                nextDate: match.date,
                lastPrint: match.lastPrint ?? card.lastPrint,
                agentConsensus: match.agentConsensus ?? card.agentConsensus,
                agentConfidence: match.agentConfidence ?? card.agentConfidence,
              };
            })
          );
        }
      } catch {
        // Silently fail — cards show "Awaiting data..."
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEconData();
    return () => { cancelled = true; };
  }, []);

  /** Fetch historical prints + scoring for a ticker on-demand */
  const fetchHistory = useCallback(async (ticker: string) => {
    if (historyCache[ticker]) return;
    try {
      const res = await fetch(`${API_BASE}/api/data/econ-history/${encodeURIComponent(ticker)}?limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setHistoryCache(prev => ({
        ...prev,
        [ticker]: {
          prints: data.history ?? [],
          scored: data.scoring ?? [],
        },
      }));
    } catch {
      // Silent fail — expanded cards will show fallback
    }
  }, [historyCache]);

  return (
    <div className={expanded ? 'flex flex-col gap-4' : ''}>
      {/* Risk Category Cards — shown first, above econ event cards */}
      {categoryScores && categoryScores.length > 0 && (
        <div className="mb-4">
          <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
            Risk Sectors — IV by Category
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {categoryScores.map(cs => {
              const color = ivHeatColor(cs.ivScore);
              const label = RISK_CATEGORY_LABELS[cs.category];
              const isExpanded = expandedTicker === `risk-${cs.category}`;
              const deltaColor = cs.delta > 0 ? '#EF4444' : cs.delta < 0 ? '#34D399' : 'var(--fintheon-muted)';
              const deltaSign = cs.delta > 0 ? '+' : '';
              const confPct = Math.round(cs.confidence * 100);

              return (
                <div
                  key={cs.category}
                  className={`flex flex-col rounded border bg-[var(--fintheon-surface)]/40 transition-all duration-300 cursor-pointer border-l-2 ${
                    isExpanded
                      ? 'border-[var(--fintheon-accent)]/30 shadow-[0_0_12px_rgba(199,159,74,0.15)]'
                      : 'border-[var(--fintheon-border)]/15 hover:border-[var(--fintheon-accent)]/20'
                  }`}
                  style={{ borderLeftColor: color }}
                  onClick={() => setExpandedTicker(prev => prev === `risk-${cs.category}` ? null : `risk-${cs.category}`)}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[11px] font-mono text-[var(--fintheon-text)]/80 uppercase tracking-wider">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold" style={{ color: deltaColor }}>
                          {deltaSign}{cs.delta.toFixed(1)}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[var(--fintheon-muted)]/30 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-mono font-bold" style={{ color, textShadow: `0 0 12px ${color}40` }}>
                        {cs.ivScore.toFixed(1)}
                      </span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase">Conf</span>
                        <div className="w-16 h-[3px] rounded-full bg-[var(--fintheon-border)]/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${confPct}%`,
                              backgroundColor: confPct >= 70 ? '#34D399' : confPct >= 50 ? '#F59E0B' : '#EF4444',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <div
                    className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
                    style={{ maxHeight: isExpanded ? '200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                  >
                    <div className="border-t border-[var(--fintheon-border)]/10 px-4 py-3 flex flex-col gap-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">IV Score</span>
                          <span className="text-xs font-mono text-[var(--fintheon-text)]">{cs.ivScore.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">Delta</span>
                          <span className="text-xs font-mono" style={{ color: deltaColor }}>{deltaSign}{cs.delta.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">Confidence</span>
                          <span className="text-xs font-mono text-[var(--fintheon-text)]">{confPct}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--fintheon-muted)]/50 leading-relaxed">
                        {cs.delta > 0.5
                          ? `${label} risk is elevated and rising — IV delta of ${deltaSign}${cs.delta.toFixed(1)} indicates increasing implied volatility pressure.`
                          : cs.delta < -0.5
                            ? `${label} risk is subsiding — IV contracting with delta ${cs.delta.toFixed(1)} suggesting reduced uncertainty.`
                            : `${label} risk is stable — minimal IV change with delta ${deltaSign}${cs.delta.toFixed(1)}.`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Economic Event Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {cards.map(card => (
          <EconCard
            key={card.ticker}
            data={card}
            expanded={expandedTicker === card.ticker}
            onToggle={() => setExpandedTicker(prev => prev === card.ticker ? null : card.ticker)}
            historyCache={historyCache}
            onFetchHistory={fetchHistory}
          />
        ))}
      </div>

      {loading && (
        <p className="text-[10px] text-[var(--fintheon-muted)]/30 text-center mt-2">
          Fetching economic data...
        </p>
      )}

      {/* FRED Macro Indicators */}
      {expanded && context && Object.keys(context.fredIndicators).length > 0 && (
        <div className="mt-6">
          <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-2 uppercase tracking-wider">
            Macro Stress Indicators (FRED)
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            {context.vixLevel != null && (
              <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-3">
                <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">VIX</span>
                <span className="text-lg font-mono font-bold text-[var(--fintheon-text)]">{context.vixLevel.toFixed(1)}</span>
              </div>
            )}
            {Object.entries(context.fredIndicators).map(([key, val]) => (
              <div key={key} className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 px-4 py-3">
                <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block">{key}</span>
                <span className="text-lg font-mono font-bold text-[var(--fintheon-text)]">{val?.toFixed(2) ?? '—'}</span>
              </div>
            ))}
          </div>
          {context.fredFetchedAt && (
            <p className="text-[8px] text-[var(--fintheon-muted)]/20 font-mono mt-1">
              Last updated: {new Date(context.fredFetchedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
