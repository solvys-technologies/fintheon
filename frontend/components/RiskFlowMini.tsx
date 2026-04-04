// [claude-code 2026-03-03] Add trade idea row rendering (gold border, click-to-modal).
// [claude-code 2026-03-10] Status dots (X CLI), dropdown filters (Priority + Source), X filter.
// [claude-code 2026-03-10] T3: critical severity renders same as high (pulse + red text)
// [claude-code 2026-03-11] v7.7.7 T3: Card overhaul — SVG logos, cyclical badge top-right,
//   point range, approve/deny CTA on proposals, chat CTA on news, remove "Neutral" text.
// [claude-code 2026-03-11] T5: drag-drop support for chat injection (application/x-riskflow)
// [claude-code 2026-03-16] T2: AlertRow bottom-hero redesign, toolbar consolidation, shared inferDirection
// [claude-code 2026-03-20] S3:T4d: Swapped chevron directions — expanded=ChevronDown, collapsed=ChevronUp
// [claude-code 2026-03-26] T3: Card expand/collapse with agent notes, risk type tags, smooth transitions
// [claude-code 2026-03-28] S8-T6: Infinite scroll + toggle, Loader2 for loading state
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRiskFlow } from '../contexts/RiskFlowContext';
import { Zap, ExternalLink, ChevronDown, ChevronUp, ChevronRight, Trash2, Diff, TrendingDown, MessageSquare, Check, XCircle, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import type { RiskFlowAlert, TradeIdeaDetail } from '../lib/riskflow-feed';
import { inferDirection } from '../lib/riskflow-feed';
import TradeIdeaModal from './TradeIdeaModal';
import { useSourceStatus } from '../hooks/useSourceStatus';
import { useBackend } from '../lib/backend';

import { SEVERITY_CONFIG } from '../lib/severity-config';
import { ivHeatColor } from '../types/miroshark';
import { AutoRefreshToggle } from './ui/AutoRefreshToggle';

// ── SVG Source Logos ──────────────────────────────────────────────────────────

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

function MarketWatchLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="MarketWatch">
      <path d="M3 17l4-8 3 5 4-10 4 8 3-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
  if (s === 'marketwatch') {
    return <MarketWatchLogo className={className} />;
  }
  if (s === 'kalshi-whale' || s === 'kalshi') {
    return <span className={`font-bold text-[8px] uppercase leading-none text-[var(--fintheon-accent)] ${className}`}>K</span>;
  }
  // Default: first letter
  return (
    <span className={`font-bold text-[8px] uppercase leading-none ${className}`}>
      {source.charAt(0)}
    </span>
  );
}

// ── Cyclical Badge ───────────────────────────────────────────────────────────

function CyclicalBadge({ classification }: { classification: string }) {
  if (classification === 'Neutral') return null;
  const isCyclical = classification === 'Cyclical';
  return (
    <span
      className={`text-[8px] font-bold tracking-[0.15em] uppercase px-1 py-px border ${
        isCyclical
          ? 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5'
          : 'border-violet-500/30 text-violet-400/80 bg-violet-500/5'
      }`}
    >
      {isCyclical ? 'CYC' : 'CTR'}
    </span>
  );
}

// ── Direction Badge (used in TradeIdeaRow) ───────────────────────────────────

function DirectionBadge({ alert }: { alert: RiskFlowAlert }) {
  const dir = inferDirection(alert);
  const isBull = dir === 'Bullish';
  return (
    <span className="text-[9px] font-semibold" style={{ color: isBull ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)' }}>
      {'±'}
    </span>
  );
}

function IVScoreBadge({ alert }: { alert: RiskFlowAlert }) {
  const score = alert.ivScore;
  if (score == null) return null;
  return (
    <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: ivHeatColor(Number(score)) }}>
      IV {Number(score).toFixed(1)}
    </span>
  );
}

// ── Risk Type Badge ──────────────────────────────────────────────────────────

function RiskTypeBadge({ riskType }: { riskType: string }) {
  return (
    <span className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-zinc-700 text-zinc-400">
      {riskType}
    </span>
  );
}

// ── Agent Note Section ──────────────────────────────────────────────────────

function AgentNoteSection({
  alert,
  onGenerate,
}: {
  alert: RiskFlowAlert;
  onGenerate: (alertId: string) => void;
}) {
  // T1 will add these fields
  const agentNote = (alert as any).agentNote as string | null | undefined;

  if (agentNote) {
    return (
      <div className="mt-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/50 text-[11px] text-zinc-300 leading-relaxed">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider block mb-1">Agent Note</span>
        {agentNote}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGenerate(alert.id); }}
      className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      Generate Note +
    </button>
  );
}

// ── Time formatting ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Trade Idea Row (proposals — with approve/deny CTA) ──────────────────────

function TradeIdeaRow({
  alert,
  onDelete,
  onOpen,
  onMarkSeen,
  onApprove,
  onDeny,
  seen,
  expanded,
  onToggleExpand,
  onGenerateNote,
}: {
  alert: RiskFlowAlert;
  onDelete: (id: string) => void;
  onOpen: (idea: TradeIdeaDetail) => void;
  onMarkSeen: (id: string) => void;
  onApprove?: (alert: RiskFlowAlert) => void;
  onDeny?: (alert: RiskFlowAlert) => void;
  seen: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onGenerateNote: (alertId: string) => void;
}) {
  const idea = alert.tradeIdea!;
  const isLong = idea.direction === 'long';
  const isShort = idea.direction === 'short';
  // T1 will add these fields
  const riskType = (alert as any).riskType as string | null | undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-riskflow', JSON.stringify({
      headline: alert.headline,
      summary: alert.summary,
      ticker: idea.ticker,
      direction: idea.direction,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative border-b border-zinc-800/50 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
        seen ? 'opacity-70' : ''
      }`}
    >
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => {
          onMarkSeen(alert.id);
          onOpen(idea);
        }}
      >
        {/* Cyclical badge — top right */}
        {alert.cyclical && alert.cyclical !== 'Neutral' && (
          <div className="absolute top-1.5 right-9">
            <CyclicalBadge classification={alert.cyclical} />
          </div>
        )}

        <div className="flex-1 min-w-0 flex items-start gap-2">
          {/* Source logo */}
          <span className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10">
            {isLong
              ? <Diff className="w-3 h-3 text-[var(--fintheon-accent)]" />
              : isShort
                ? <TrendingDown className="w-3 h-3 text-zinc-400" />
                : <NotionLogo className="w-3 h-3 text-[var(--fintheon-accent)]" />
            }
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-snug font-medium line-clamp-2 text-[var(--fintheon-text)] group-hover:text-white transition-colors">
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">{alert.summary}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <NotionLogo className="w-2.5 h-2.5 text-zinc-600" />
              <span className="text-[10px] text-zinc-600">{timeAgo(alert.publishedAt)}</span>
              <span className="text-[10px] text-zinc-700">&middot;</span>
              <span className="text-[10px] text-[var(--fintheon-accent)]/60 uppercase tracking-wider">
                {idea.sourceAgent ?? 'Proposal'}
              </span>
              {idea.riskRewardRatio && (
                <>
                  <span className="text-[10px] text-zinc-700">&middot;</span>
                  <span className="text-[10px] text-zinc-500">R/R {idea.riskRewardRatio.toFixed(1)}:1</span>
                </>
              )}
              <span className="text-[10px] text-zinc-700">&middot;</span>
              <DirectionBadge alert={alert} />
              <span className="text-[10px] text-zinc-700">&middot;</span>
              {alert.ivScore != null && (
                <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: ivHeatColor(Number(alert.ivScore)) }}>
                  IV {Number(alert.ivScore).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand chevron + Approve / Deny CTA */}
        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="p-1 rounded text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApprove?.(alert); }}
              className="p-1 rounded text-emerald-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Approve proposal"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeny?.(alert); }}
              className="p-1 rounded text-red-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Deny proposal"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content — smooth CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40">
            <AgentNoteSection alert={alert} onGenerate={onGenerateNote} />
            {riskType && (
              <div className="flex items-center gap-1.5 mt-2">
                <RiskTypeBadge riskType={riskType} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Alert Row (news — square edge-to-edge card with bottom-hero footer) ──────

function AlertRow({
  alert,
  onMarkSeen,
  onChat,
  seen,
  expanded,
  onToggleExpand,
  onGenerateNote,
  onNavigateToFeed,
}: {
  alert: RiskFlowAlert;
  onMarkSeen: (id: string) => void;
  onChat?: (alert: RiskFlowAlert) => void;
  seen: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onGenerateNote: (alertId: string) => void;
  onNavigateToFeed?: () => void;
}) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === 'high' || alert.severity === 'critical';
  const dir = inferDirection(alert);
  const isBull = dir === 'Bullish';
  // T1 will add these fields
  const riskType = (alert as any).riskType as string | null | undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-riskflow', JSON.stringify({
      headline: alert.headline,
      summary: alert.summary,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative border-b border-zinc-800/60 overflow-hidden hover:border-[var(--fintheon-accent)]/30 transition-colors ${isHigh ? 'riskflow-fintheon-row' : ''} ${seen ? 'opacity-70' : ''}`}
    >
      {/* Main content area */}
      <div
        className="block px-3 pt-2.5 pb-2 cursor-pointer"
        onClick={() => { onMarkSeen(alert.id); onToggleExpand(); }}
      >
        <div className="flex items-start gap-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border ${sev.glow || ''} flex-shrink-0 mt-0.5`}>
            {sev.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs leading-snug font-medium line-clamp-3 break-words ${alert.severity === 'critical' ? 'text-orange-300' : isHigh ? 'text-red-300' : 'text-zinc-300'} group-hover:text-white transition-colors`}>
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">{alert.summary}</p>
            )}
            {/* Cyclical badge + risk type + author row */}
            <div className="flex items-center gap-1.5 mt-1">
              {alert.cyclical && alert.cyclical !== 'Neutral' && (
                <CyclicalBadge classification={alert.cyclical} />
              )}
              {riskType && <RiskTypeBadge riskType={riskType} />}
              {alert.authorHandle && (
                <span className="text-[9px] text-zinc-500">@{alert.authorHandle}</span>
              )}
            </div>
          </div>

          {/* Chat + Dismiss CTAs */}
          <div className="flex-shrink-0 flex items-center gap-0.5">
            {onChat && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChat(alert); }}
                className="p-1 rounded text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Chat about this"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom hero footer — time (left), direction chevron + IV (right) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-t border-zinc-800/40">
        <span className="text-[10px] text-zinc-600">{timeAgo(alert.publishedAt)}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold" style={{ color: isBull ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)' }}>
            {isBull ? '▲' : '▼'}
          </span>
          {alert.ivScore != null && (
            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: ivHeatColor(Number(alert.ivScore)) }}>
              IV {Number(alert.ivScore).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded content — smooth CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40">
            <AgentNoteSection alert={alert} onGenerate={onGenerateNote} />

            {/* S9-T2: Deviation indicators — beat/miss, implied points */}
            {alert.econData?.beatMiss && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  alert.econData.beatMiss === 'beat' ? 'bg-emerald-500/15 text-emerald-400' :
                  alert.econData.beatMiss === 'miss' ? 'bg-red-500/15 text-red-400' :
                  'bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]'
                }`}>
                  {alert.econData.beatMiss.toUpperCase()}
                </span>
              </div>
            )}

            {/* Footer — fuse shimmer with IV KPI + View in RiskFlow */}
            <div className="flex items-center mt-2.5">
              {alert.ivScore != null ? (
                <div className="relative flex-1 flex items-center h-[18px]">
                  {/* Fuse wire — 2px shimmer, edge to edge */}
                  <div
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] riskflow-fuse-shimmer"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${ivHeatColor(Number(alert.ivScore))}60, transparent)`,
                      backgroundSize: '200% 100%',
                    }}
                  />
                  {/* IV score KPI — sits on the fuse wire */}
                  <span
                    className="relative z-10 text-[9px] font-mono font-bold tabular-nums px-1 bg-zinc-900/90"
                    style={{ color: ivHeatColor(Number(alert.ivScore)) }}
                  >
                    IV {Number(alert.ivScore).toFixed(1)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1">
                  {riskType && <RiskTypeBadge riskType={riskType} />}
                  {alert.cyclical && alert.cyclical !== 'Neutral' && (
                    <CyclicalBadge classification={alert.cyclical} />
                  )}
                </div>
              )}
              {onNavigateToFeed && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigateToFeed(); }}
                  className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors flex items-center gap-1 ml-2 shrink-0"
                >
                  View in RiskFlow
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Dot ─────────────────────────────────────────────────────────────────

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="flex items-center gap-1"
      title={`${label}: ${active ? 'connected' : 'disconnected'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      <span className={`text-[9px] uppercase tracking-wider ${active ? 'text-emerald-400/60' : 'text-zinc-700'}`}>{label}</span>
    </span>
  );
}

// ── Filter Dropdown ────────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="px-1.5 py-0.5 bg-[var(--fintheon-bg)] border border-zinc-800 rounded text-[10px] text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

type PriorityFilter = 'all' | 'high' | 'medium';
type SourceFilter = 'all' | 'notion' | 'twitter';

export default function RiskFlowMini({
  collapsed,
  onToggleCollapsed,
  onChatAlert,
  onNavigateToFeed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called when user clicks "Chat" CTA on a news alert */
  onChatAlert?: (alert: RiskFlowAlert) => void;
  /** Called when user clicks "View in RiskFlow" in expanded card */
  onNavigateToFeed?: () => void;
}) {
  const { alerts, highCount, mediumCount, clearAll, removeAlert, markSeen, markAllSeen, isSeen, refresh, refreshing, initialLoaded, loadMore, loadingMore, hasMore } = useRiskFlow();
  const backend = useBackend();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showProposals, setShowProposals] = useState(false);
  const [expandedInternal, setExpandedInternal] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [infiniteScroll, setInfiniteScroll] = useState(() => {
    try { return localStorage.getItem('fintheon:infinite-scroll') !== 'off'; } catch { return true; }
  });
  const sourceStatus = useSourceStatus();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const expanded = collapsed != null ? !collapsed : expandedInternal;

  // Persist infinite scroll preference
  useEffect(() => {
    try { localStorage.setItem('fintheon:infinite-scroll', infiniteScroll ? 'on' : 'off'); } catch {}
  }, [infiniteScroll]);

  // Infinite scroll observer — only active when expanded
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !expanded || !infiniteScroll) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [expanded, hasMore, loadingMore, loadMore, infiniteScroll]);

  const handleGenerateNote = useCallback(async (alertId: string) => {
    const rawId = alertId.replace(/^backend-/, '');
    try {
      await backend.riskflow.generateNote(rawId);
    } catch (err) {
      console.warn('[RiskFlowMini] Generate note failed:', err);
    }
  }, [backend]);

  /** Extract Notion page ID from the alert ID (format: notion-ti-{pageId}) */
  const getNotionPageId = (alertId: string) => alertId.replace('notion-ti-', '');

  const handleApprove = useCallback(async (alert: RiskFlowAlert) => {
    const pageId = getNotionPageId(alert.id);
    const ok = await backend.notion.updateTradeIdeaStatus(pageId, 'Approved');
    if (ok) removeAlert(alert.id);
  }, [backend, removeAlert]);

  const handleDeny = useCallback(async (alert: RiskFlowAlert) => {
    const pageId = getNotionPageId(alert.id);
    const ok = await backend.notion.updateTradeIdeaStatus(pageId, 'Denied');
    if (ok) removeAlert(alert.id);
  }, [backend, removeAlert]);

  const ideaCount = alerts.filter((a) => a.source === 'notion-trade-idea').length;

  const filtered = (() => {
    let base = alerts;
    if (showProposals) return base.filter((a) => a.source === 'notion-trade-idea');
    if (priorityFilter === 'high') base = base.filter((a) => a.severity === 'high' || a.severity === 'critical');
    else if (priorityFilter === 'medium') base = base.filter((a) => a.severity === 'medium');
    if (sourceFilter === 'notion') base = base.filter((a) => a.source === 'notion-trade-idea' || (a.source as string).toLowerCase().includes('notion'));
    else if (sourceFilter === 'twitter') base = base.filter((a) => (a.source as string).toLowerCase().includes('twitter') || (a.source as string) === 'TwitterCli' || (a.source as string) === 'FinancialJuice');
    return base;
  })();

  const collapsedPreviewItems = alerts.slice(0, 2);

  React.useEffect(() => {
    if (!expanded) return;
    markAllSeen(filtered.map((item) => item.id));
  }, [expanded, filtered, markAllSeen]);

  return (
    <>
      {selectedIdea && (
        <TradeIdeaModal idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
      )}

      <div className="h-full flex flex-col bg-[var(--fintheon-surface)]">
        {/* Header — title + filters + status consolidated */}
        <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
              <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">RiskFlow</h3>
              {highCount > 0 && (
                <span className="riskflow-pulse-badge inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/30 text-red-400 text-[9px] font-bold">
                  {highCount}
                </span>
              )}
              <div className="flex items-center gap-2 ml-1">
                <StatusDot active={sourceStatus.twitterCli} label="X" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AutoRefreshToggle />
              <span className="text-[8px] text-zinc-600 hidden xl:inline">Auto 30s</span>
              <button
                type="button"
                onClick={() => { void refresh(); }}
                disabled={refreshing}
                className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
                title="Refresh feeds"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              {alerts.length > 0 && (
                <button type="button" onClick={clearAll} className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Clear all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { if (onToggleCollapsed) onToggleCollapsed(); else setExpandedInternal(!expandedInternal); }}
                className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
              >
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {/* Inline filters — same row as header */}
          {expanded && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <FilterDropdown<PriorityFilter>
                value={showProposals ? 'all' : priorityFilter}
                options={[
                  { value: 'all', label: `Priority: All` },
                  { value: 'high', label: `High (${highCount})` },
                  { value: 'medium', label: `Med (${mediumCount})` },
                ]}
                onChange={(v) => { setShowProposals(false); setPriorityFilter(v); }}
              />
              <FilterDropdown<SourceFilter>
                value={showProposals ? 'all' : sourceFilter}
                options={[
                  { value: 'all', label: 'Source: All' },
                  { value: 'twitter', label: 'X / FJ' },
                ]}
                onChange={(v) => { setShowProposals(false); setSourceFilter(v); }}
              />
              <button
                onClick={() => setShowProposals((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  showProposals
                    ? 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50'
                }`}
              >
                Proposals{ideaCount > 0 ? ` (${ideaCount})` : ''}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[9px] text-zinc-600">Infinite Scroll</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={infiniteScroll}
                  onClick={() => setInfiniteScroll(v => !v)}
                  className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors shrink-0 ${
                    infiniteScroll
                      ? 'bg-[var(--fintheon-accent)]/30 border border-[var(--fintheon-accent)]/50'
                      : 'bg-zinc-800 border border-zinc-700'
                  }`}
                  title={infiniteScroll ? 'Infinite scroll ON' : 'Infinite scroll OFF'}
                >
                  <span className={`inline-block w-2 h-2 rounded-full transition-transform ${
                    infiniteScroll ? 'translate-x-3 bg-[var(--fintheon-accent)]' : 'translate-x-0.5 bg-zinc-500'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`flex-1 min-h-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'opacity-100' : 'max-h-0 opacity-0'}`}>

            {/* Alert list */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-zinc-700 text-xs">
                  {alerts.length === 0
                    ? (initialLoaded ? 'Waiting for signals...' : 'Loading feed...')
                    : 'No matching alerts'}
                </div>
              ) : (
                filtered.map((alert) =>
                  alert.source === 'notion-trade-idea' && alert.tradeIdea ? (
                    <TradeIdeaRow
                      key={alert.id}
                      alert={alert}
                      onDelete={removeAlert}
                      onOpen={setSelectedIdea}
                      onMarkSeen={markSeen}
                      onApprove={handleApprove}
                      onDeny={handleDeny}
                      seen={isSeen(alert.id)}
                      expanded={expandedId === alert.id}
                      onToggleExpand={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                      onGenerateNote={handleGenerateNote}
                    />
                  ) : (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onMarkSeen={markSeen}
                      onChat={onChatAlert}
                      seen={isSeen(alert.id)}
                      expanded={expandedId === alert.id}
                      onToggleExpand={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                      onGenerateNote={handleGenerateNote}
                      onNavigateToFeed={onNavigateToFeed}
                    />
                  )
                )
              )}

              {/* Infinite scroll sentinel + load more */}
              {infiniteScroll ? (
                <div ref={sentinelRef} className="h-1" />
              ) : (
                hasMore && filtered.length > 0 && (
                  <div className="flex justify-center py-3">
                    <button
                      type="button"
                      onClick={() => { void loadMore(); }}
                      disabled={loadingMore}
                      className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors px-3 py-1.5 border border-zinc-800 rounded hover:border-[var(--fintheon-accent)]/30 disabled:opacity-40"
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )
              )}

              {loadingMore && (
                <div className="flex items-center justify-center py-3 gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[var(--fintheon-accent)] animate-spin" />
                  <span className="text-[9px] text-[var(--fintheon-muted)]/40">Loading more...</span>
                </div>
              )}

              {!hasMore && filtered.length > 0 && (
                <div className="text-center py-2">
                  <span className="text-[8px] text-[var(--fintheon-muted)]/25">All items loaded</span>
                </div>
              )}
            </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${!expanded ? 'opacity-100' : 'max-h-0 opacity-0'}`}>
        {!expanded && (
          <div className="px-2 pb-2">
            {collapsedPreviewItems.length === 0 ? (
              <div className="rounded border border-zinc-800/80 bg-[#080806] px-3 py-2 text-[11px] text-zinc-600">
                No recent items
              </div>
            ) : (
              <div className="bg-[#080806] overflow-hidden">
                {collapsedPreviewItems.map((item, idx) => {
                  const sev = SEVERITY_CONFIG[item.severity];
                  const seen = isSeen(item.id);
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSeen(item.id)}
                      className={`block px-3 py-2 ${idx < collapsedPreviewItems.length - 1 ? 'border-b border-zinc-800/80' : ''} ${seen ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <SourceIcon source={item.source} className="w-2.5 h-2.5 text-zinc-500" />
                        <span className={`text-[9px] font-semibold tracking-wider ${sev.text}`}>
                          {sev.label}
                        </span>
                        {item.cyclical && item.cyclical !== 'Neutral' && (
                          <CyclicalBadge classification={item.cyclical} />
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-300 line-clamp-1">
                        {item.headline}
                      </p>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Fintheon animation styles */}
        <style>{`
          @keyframes riskflow-pulse {
            0%, 100% { box-shadow: none; }
            50% { box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.08); }
          }
          .riskflow-fintheon-row { animation: riskflow-pulse 3s ease-in-out infinite; }
          @keyframes riskflow-badge-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.15); opacity: 0.8; }
          }
          .riskflow-pulse-badge { animation: riskflow-badge-pulse 2s ease-in-out infinite; }
        `}</style>
      </div>
    </>
  );
}
