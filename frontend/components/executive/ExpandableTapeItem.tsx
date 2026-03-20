// [claude-code 2026-03-05] Expandable tape item for ExecutiveDashboard — shows full RiskFlow detail on click
// [claude-code 2026-03-11] Replace text source label with SVG icons (X/Notion)
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { SEVERITY_CONFIG } from '../../lib/severity-config';
import type { RiskFlowAlert, TradeIdeaDetail } from '../../lib/riskflow-feed';

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="X">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NotionLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Notion">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.45 2.29c-.42-.326-.98-.7-2.055-.607L3.62 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.214-.14c-.093-.513.28-.886.747-.933zM2.667 1.21l13.728-1.027c1.68-.14 2.1.093 2.8.606l3.874 2.707c.466.326.606.746.606 1.26v15.7c0 .933-.326 1.493-1.494 1.586l-15.457.933c-.84.047-1.26-.093-1.727-.653L1.88 19.01c-.513-.653-.746-1.166-.746-1.86V2.89c0-.84.373-1.54 1.54-1.68z" />
    </svg>
  );
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const s = source.toLowerCase();
  if (s === 'twitter-cli' || s === 'twittercli' || s.includes('twitter') || s === 'financialjuice' || s === 'financial-juice') {
    return <XLogo className={className} />;
  }
  if (s === 'notion-trade-idea' || s.includes('notion')) {
    return <NotionLogo className={className} />;
  }
  return <span className={`font-bold text-[7px] uppercase ${className}`}>{source.charAt(0)}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Infer Bullish/Bearish from alert data or headline keywords */
function inferDirection(alert: RiskFlowAlert): 'Bullish' | 'Bearish' {
  if (alert.direction === 'Bullish' || alert.direction === 'Bearish') return alert.direction;
  if (alert.tradeIdea) return alert.tradeIdea.direction === 'long' ? 'Bullish' : 'Bearish';
  const lower = (alert.headline + ' ' + (alert.summary ?? '')).toLowerCase();
  const bullish = ['surge', 'rally', 'rise', 'gain', 'jump', 'soar', 'bull', 'record high', 'beat', 'above', 'upgrade', 'boom', 'positive', 'strong', 'up '];
  const bearish = ['drop', 'fall', 'crash', 'plunge', 'decline', 'sink', 'bear', 'miss', 'below', 'downgrade', 'slump', 'negative', 'fear', 'risk', 'warn', 'cut', 'sell', 'weak', 'down '];
  let b = 0, s = 0;
  for (const kw of bullish) if (lower.includes(kw)) b++;
  for (const kw of bearish) if (lower.includes(kw)) s++;
  return b >= s ? 'Bullish' : 'Bearish';
}

interface ExpandableTapeItemProps {
  alert: RiskFlowAlert;
  isVivid: boolean;
  opacity: number;
  borderOpacity: number;
  seen: boolean;
  onOpenIdea: (idea: TradeIdeaDetail) => void;
}

export function ExpandableTapeItem({ alert, isVivid, opacity, borderOpacity, seen, onOpenIdea }: ExpandableTapeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isTradeIdea = alert.source === 'notion-trade-idea' && !!alert.tradeIdea;
  const sev = SEVERITY_CONFIG[alert.severity];

  return (
    <div
      className={`border-l-2 ${
        isTradeIdea
          ? 'border-l-[var(--fintheon-accent)]/50 bg-[#0b0b08]'
          : isVivid
            ? 'bg-[#0b0b08] border-emerald-500/40'
            : 'bg-[#080806]'
      }`}
      style={isVivid || isTradeIdea ? undefined : { opacity, borderLeftColor: `rgba(16, 185, 129, ${borderOpacity})` }}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isTradeIdea ? (
              <span className="inline-flex items-center justify-center w-4 h-4 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 flex-shrink-0">
                {alert.tradeIdea!.direction === 'long'
                  ? <TrendingUp className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                  : <TrendingDown className="w-2.5 h-2.5 text-zinc-400" />}
              </span>
            ) : (
              <>
                {alert.severity === 'high' && (
                  <span className="text-[9px] tracking-[0.18em] uppercase text-red-400 font-semibold">Breaking</span>
                )}
                {alert.severity === 'medium' && (
                  <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text}`}>
                    {sev.label}
                  </span>
                )}
              </>
            )}
            <span className={`text-xs font-semibold truncate ${isVivid || isTradeIdea ? 'text-white' : 'text-gray-400'}`}>
              {alert.headline}
            </span>
          </div>
          {!expanded && alert.summary && alert.summary !== alert.headline && (
            <div className={`mt-0.5 text-[11px] line-clamp-1 ${isVivid ? 'text-gray-400' : 'text-gray-500'}`}>
              {alert.summary}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {(() => {
            const dir = inferDirection(alert);
            return <span className={`text-[9px] font-semibold ${dir === 'Bullish' ? 'text-emerald-500' : 'text-red-400'}`}>{dir === 'Bullish' ? '▲' : '▼'}</span>;
          })()}
          <span className="text-[9px] text-zinc-500 tabular-nums">
            {alert.pointRange != null && alert.pointRange !== 0 ? `±${Math.abs(alert.pointRange).toFixed(0)}pt` : '0-5pt'}
          </span>
          <span className={`text-[10px] ${isVivid ? 'text-gray-500' : 'text-gray-600'}`}>
            {timeAgo(alert.publishedAt)}
          </span>
          {expanded
            ? <ChevronUp className="w-3 h-3 text-zinc-600" />
            : <ChevronDown className="w-3 h-3 text-zinc-600" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-zinc-800/40">
          {/* Summary */}
          {alert.summary && (
            <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">{alert.summary}</p>
          )}

          {/* Trade Idea detail */}
          {isTradeIdea && alert.tradeIdea && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                {alert.tradeIdea.entry != null && (
                  <div>
                    <span className="text-gray-600 uppercase tracking-wider">Entry</span>
                    <div className="mt-0.5 text-gray-300">${alert.tradeIdea.entry}</div>
                  </div>
                )}
                {alert.tradeIdea.stopLoss != null && (
                  <div>
                    <span className="text-gray-600 uppercase tracking-wider">Stop</span>
                    <div className="mt-0.5 text-red-400/80">${alert.tradeIdea.stopLoss}</div>
                  </div>
                )}
                {alert.tradeIdea.takeProfit != null && (
                  <div>
                    <span className="text-gray-600 uppercase tracking-wider">Target</span>
                    <div className="mt-0.5 text-emerald-400/80">${alert.tradeIdea.takeProfit}</div>
                  </div>
                )}
              </div>
              {alert.tradeIdea.riskRewardRatio != null && (
                <div className="text-[10px] text-zinc-500">
                  R/R {alert.tradeIdea.riskRewardRatio.toFixed(1)}:1
                  {alert.tradeIdea.confidence && ` · ${alert.tradeIdea.confidence}% confidence`}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenIdea(alert.tradeIdea!); }}
                className="mt-1 text-[10px] text-[var(--fintheon-accent)] hover:text-[#dbb85c] transition-colors uppercase tracking-wider"
              >
                View Full Proposal →
              </button>
            </div>
          )}

          {/* Regular alert detail */}
          {!isTradeIdea && (
            <div className="mt-2 flex items-center gap-3">
              <SourceIcon source={alert.source} className="w-3 h-3 text-zinc-500 flex-shrink-0" />
              {alert.tags.length > 0 && (
                <div className="flex gap-1">
                  {alert.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500">{tag}</span>
                  ))}
                </div>
              )}
              {alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  Source
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
