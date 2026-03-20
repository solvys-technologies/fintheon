// [claude-code 2026-03-05] Phase 3B: RiskFlow mini widget for Mission Control deck
// [claude-code 2026-03-10] T3: critical severity dot (orange)
import { useState } from 'react';
import { Zap, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { SEVERITY_CONFIG } from '../../lib/severity-config';
import type { TradeIdeaDetail } from '../../lib/riskflow-feed';
import TradeIdeaModal from '../TradeIdeaModal';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const VISIBLE_COUNT = 4;

export function RiskFlowMiniWidget() {
  const { alerts, highCount, isSeen, markSeen } = useRiskFlow();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(null);

  const unseenCount = alerts.filter((a) => !isSeen(a.id)).length;
  const visible = alerts.slice(0, VISIBLE_COUNT);
  const moreCount = Math.max(0, alerts.length - VISIBLE_COUNT);

  return (
    <>
      {selectedIdea && (
        <TradeIdeaModal idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
      )}

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">RiskFlow</span>
          {unseenCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500/30 text-red-400 text-[9px] font-bold">
              {unseenCount}
            </span>
          )}
        </div>

        {/* Compact alert rows */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {visible.length === 0 ? (
            <div className="text-[10px] text-zinc-600 py-2">No alerts</div>
          ) : (
            visible.map((alert) => {
              const sev = SEVERITY_CONFIG[alert.severity];
              const isTradeIdea = alert.source === 'notion-trade-idea' && !!alert.tradeIdea;
              const isExpanded = expandedId === alert.id;
              const seen = isSeen(alert.id);

              return (
                <div
                  key={alert.id}
                  className={`rounded ${isTradeIdea ? 'border-l-2 border-l-[var(--fintheon-accent)]/40' : ''} ${seen ? 'opacity-60' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      markSeen(alert.id);
                      setExpandedId(isExpanded ? null : alert.id);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Severity dot or direction icon */}
                    {isTradeIdea ? (
                      alert.tradeIdea!.direction === 'long'
                        ? <TrendingUp className="w-2.5 h-2.5 text-[var(--fintheon-accent)] shrink-0" />
                        : <TrendingDown className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        alert.severity === 'critical' ? 'bg-orange-400' :
                        alert.severity === 'high' ? 'bg-red-400' :
                        alert.severity === 'medium' ? 'bg-[var(--fintheon-accent)]' : 'bg-zinc-600'
                      }`} />
                    )}
                    <span className="flex-1 min-w-0 text-[11px] text-zinc-300 truncate">
                      {alert.headline}
                    </span>
                    <span className="text-[9px] text-zinc-600 shrink-0">{timeAgo(alert.publishedAt)}</span>
                    {isExpanded
                      ? <ChevronUp className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
                      : <ChevronDown className="w-2.5 h-2.5 text-zinc-600 shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-2 border-t border-zinc-800/30">
                      {alert.summary && (
                        <p className="mt-1 text-[10px] text-zinc-500 leading-relaxed">{alert.summary}</p>
                      )}
                      {isTradeIdea && alert.tradeIdea && (
                        <button
                          type="button"
                          onClick={() => setSelectedIdea(alert.tradeIdea!)}
                          className="mt-1 text-[9px] text-[var(--fintheon-accent)] hover:text-[#dbb85c] transition-colors uppercase tracking-wider"
                        >
                          View Proposal →
                        </button>
                      )}
                      {!isTradeIdea && alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <ExternalLink className="w-2 h-2" /> Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {moreCount > 0 && (
          <div className="mt-1 text-[9px] text-zinc-600 text-center">
            +{moreCount} more alert{moreCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </>
  );
}
