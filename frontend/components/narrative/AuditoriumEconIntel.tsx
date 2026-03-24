// [claude-code 2026-03-23] Auditorium Page 2 — Economic Intelligence cards
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarClock } from 'lucide-react';
import type { EconCardData, SimulationContext } from '../../types/mirofish';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ECON_TICKERS: EconCardData[] = [
  { name: 'Consumer Price Index', ticker: 'CPI' },
  { name: 'Personal Income', ticker: 'PI' },
  { name: 'Gross Domestic Product', ticker: 'GDP' },
  { name: 'Purchasing Mgrs Index', ticker: 'PMI' },
  { name: 'Personal Consumption', ticker: 'PCE' },
  { name: 'Fed Rate Decision', ticker: 'FOMC' },
  { name: 'Rate Cut Expectations', ticker: 'CUTS' },
];

const DIRECTION_CONFIG = {
  beat: { icon: TrendingUp, color: '#34D399', label: 'BEAT' },
  miss: { icon: TrendingDown, color: '#EF4444', label: 'MISS' },
  inline: { icon: Minus, color: '#F59E0B', label: 'INLINE' },
} as const;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#34D399' : pct >= 50 ? '#F59E0B' : '#EF4444';
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

function EconCard({ data }: { data: EconCardData }) {
  const direction = data.agentConsensus ?? 'inline';
  const cfg = DIRECTION_CONFIG[direction];
  const Icon = cfg.icon;
  const hasAgent = data.agentConsensus != null;

  return (
    <div className="flex flex-col rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40 p-4 hover:border-[var(--fintheon-accent)]/20 transition-colors">
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
        {hasAgent && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
          >
            <Icon className="w-3 h-3" />
            {cfg.label}
          </div>
        )}
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
  );
}

interface AuditoriumEconIntelProps {
  expanded?: boolean;
  context?: SimulationContext | null;
}

export function AuditoriumEconIntel({ expanded, context }: AuditoriumEconIntelProps) {
  const [cards, setCards] = useState<EconCardData[]>(ECON_TICKERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchEconData() {
      try {
        const res = await fetch(`${API_BASE}/api/data/econ-events`);
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

  return (
    <div className={expanded ? 'flex flex-col gap-4' : ''}>
      <div className={`grid gap-3 ${expanded ? 'grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}`}>
        {cards.map(card => (
          <EconCard key={card.ticker} data={card} />
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
