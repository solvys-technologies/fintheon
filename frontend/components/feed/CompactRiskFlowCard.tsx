// [claude-code 2026-03-11] Compact RiskFlow card for combined panels
// [claude-code 2026-03-11] Replaced SourceDot with SVG icons (X/Notion), removed direction triangle
// [claude-code 2026-03-12] Disabled card expand, added dismiss button, headline-only link
// [claude-code 2026-03-16] FIX 3: Use shared inferDirection, show instrument to match large cards
import { X as XIcon } from 'lucide-react';
import type { RiskFlowAlert } from '../../lib/riskflow-feed';
import { inferDirection } from '../../lib/riskflow-feed';
import { SEVERITY_CONFIG } from '../../lib/severity-config';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

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

interface CompactRiskFlowCardProps {
  alert: RiskFlowAlert;
  seen?: boolean;
  onDismiss?: (id: string) => void;
}

export function CompactRiskFlowCard({ alert, seen = false, onDismiss }: CompactRiskFlowCardProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === 'high' || alert.severity === 'critical';
  const dir = inferDirection(alert);
  const isBull = dir === 'Bullish';

  return (
    <div
      className={`group rounded-xl border border-zinc-800/60 overflow-hidden hover:border-[var(--fintheon-accent)]/30 transition-colors ${isHigh ? 'bg-red-500/5' : ''} ${seen ? 'opacity-60' : ''}`}
    >
      {/* Main content area */}
      <div className="px-2.5 pt-2 pb-1.5">
        <div className="flex items-start gap-2">
          <span className={`inline-flex items-center px-1 py-px rounded text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border flex-shrink-0 mt-0.5`}>
            {sev.label}
          </span>
          <div className="flex-1 min-w-0">
            {alert.url ? (
              <a
                href={alert.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-[11px] leading-snug font-medium line-clamp-2 block ${isHigh ? 'text-red-300' : 'text-zinc-300'} hover:text-white transition-colors`}
              >
                {alert.headline}
              </a>
            ) : (
              <p className={`text-[11px] leading-snug font-medium line-clamp-2 ${isHigh ? 'text-red-300' : 'text-zinc-300'}`}>
                {alert.headline}
              </p>
            )}
            {/* Source + author row */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <SourceIcon source={alert.source} className="w-2.5 h-2.5 text-zinc-600 flex-shrink-0" />
              {alert.authorHandle && (
                <span className="text-[8px] text-zinc-500 truncate max-w-[80px]">@{alert.authorHandle}</span>
              )}
            </div>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
              className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
              title="Dismiss"
            >
              <XIcon className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom hero footer — time (left), direction (center), points (right) */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-zinc-900/80 border-t border-zinc-800/40">
        <span className="text-[8px] text-zinc-600">{timeAgo(alert.publishedAt)}</span>
        <span className={`text-[9px] font-bold tracking-wider uppercase ${isBull ? 'text-emerald-500' : 'text-red-400'}`}>
          {isBull ? '▲ BULLISH' : '▼ BEARISH'}
        </span>
        <span className="text-[8px] text-zinc-500 tabular-nums font-mono">
          {alert.instrument ? `${alert.instrument} ` : ''}{alert.pointRange != null && alert.pointRange !== 0 ? `±${Math.abs(alert.pointRange).toFixed(0)}pt` : '0-5pt'}
        </span>
      </div>
    </div>
  );
}
