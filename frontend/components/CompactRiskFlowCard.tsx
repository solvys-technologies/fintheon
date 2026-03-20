// [claude-code 2026-03-11] v7.7.7 T3: CompactRiskFlowCard — minimal/mini variants
// for embedding RiskFlow alerts in dashboards, sidebars, and widgets.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import React from 'react';
import { TrendingUp, TrendingDown, MessageSquare, Check, XCircle, ExternalLink } from 'lucide-react';
import type { RiskFlowAlert, TradeIdeaDetail } from '../lib/riskflow-feed';
import { SEVERITY_CONFIG } from '../lib/severity-config';

// ── SVG Logos (inline, no deps) ──────────────────────────────────────────────

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NotionLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.45 2.29c-.42-.326-.98-.7-2.055-.607L3.62 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.214-.14c-.093-.513.28-.886.747-.933zM2.667 1.21l13.728-1.027c1.68-.14 2.1.093 2.8.606l3.874 2.707c.466.326.606.746.606 1.26v15.7c0 .933-.326 1.493-1.494 1.586l-15.457.933c-.84.047-1.26-.093-1.727-.653L1.88 19.01c-.513-.653-.746-1.166-.746-1.86V2.89c0-.84.373-1.54 1.54-1.68z" />
    </svg>
  );
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const s = source.toLowerCase();
  if (s === 'twitter-cli' || s.includes('twitter')) return <XLogo className={className} />;
  if (s === 'notion-trade-idea' || s.includes('notion')) return <NotionLogo className={className} />;
  return <span className={`font-bold text-[7px] uppercase ${className}`}>{source.charAt(0)}</span>;
}

// ── Time ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Types ───────────────────────────────────────────────────────────────────

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

type CompactVariant = 'minimal' | 'mini';

interface CompactRiskFlowCardProps {
  alert: RiskFlowAlert;
  variant?: CompactVariant;
  onDismiss?: (id: string) => void;
  onChat?: (alert: RiskFlowAlert) => void;
  onApprove?: (alert: RiskFlowAlert) => void;
  onDeny?: (id: string) => void;
  onOpenProposal?: (idea: TradeIdeaDetail) => void;
  seen?: boolean;
}

// ── Mini variant (single-line, ultra-compact — for ticker-tape / widget) ────

function MiniCard({ alert, onDismiss, seen }: CompactRiskFlowCardProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isProposal = alert.source === 'notion-trade-idea' && alert.tradeIdea;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 border-b border-zinc-800/30 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
        seen ? 'opacity-60' : ''
      }`}
    >
      <SourceIcon source={alert.source} className="w-2.5 h-2.5 text-zinc-600 flex-shrink-0" />
      <span className={`text-[8px] font-bold tracking-wider ${sev.text} flex-shrink-0`}>
        {sev.label}
      </span>
      {isProposal && alert.tradeIdea && (
        <span className="flex-shrink-0">
          {alert.tradeIdea.direction === 'long'
            ? <TrendingUp className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
            : alert.tradeIdea.direction === 'short'
              ? <TrendingDown className="w-2.5 h-2.5 text-zinc-400" />
              : null
          }
        </span>
      )}
      <a
        href={alert.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-[10px] text-zinc-300 truncate hover:text-white transition-colors"
      >
        {alert.headline}
      </a>
      {(() => {
        const dir = inferDirection(alert);
        return <span className={`text-[8px] font-semibold flex-shrink-0 ${dir === 'Bullish' ? 'text-emerald-500' : 'text-red-400'}`}>{dir === 'Bullish' ? '▲' : '▼'}</span>;
      })()}
      <span className="text-[8px] text-zinc-600 tabular-nums flex-shrink-0">
        {alert.pointRange != null && alert.pointRange !== 0 ? `±${Math.abs(alert.pointRange).toFixed(0)}` : '0-5'}
      </span>
      {alert.cyclical && alert.cyclical !== 'Neutral' && (
        <span className={`text-[7px] font-bold tracking-wider flex-shrink-0 ${
          alert.cyclical === 'Cyclical' ? 'text-[var(--fintheon-accent)]/60' : 'text-violet-400/60'
        }`}>
          {alert.cyclical === 'Cyclical' ? 'CYC' : 'CTR'}
        </span>
      )}
      <span className="text-[8px] text-zinc-700 flex-shrink-0">{timeAgo(alert.publishedAt)}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0"
          title="Dismiss"
        >
          <span className="text-[9px]">&times;</span>
        </button>
      )}
    </div>
  );
}

// ── Minimal variant (2-line card, compact but readable) ─────────────────────

function MinimalCard({
  alert,
  onDismiss,
  onChat,
  onApprove,
  onDeny,
  onOpenProposal,
  seen,
}: CompactRiskFlowCardProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isProposal = alert.source === 'notion-trade-idea' && alert.tradeIdea;
  const isHigh = alert.severity === 'high' || alert.severity === 'critical';

  const handleClick = () => {
    if (isProposal && alert.tradeIdea && onOpenProposal) {
      onOpenProposal(alert.tradeIdea);
    }
  };

  return (
    <div
      className={`group relative px-2.5 py-2 border-b border-zinc-800/40 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
        isProposal ? 'border-l-2 border-l-[var(--fintheon-accent)]/40 cursor-pointer' : ''
      } ${isHigh ? 'riskflow-pulse-row' : ''} ${seen ? 'opacity-60' : ''}`}
      onClick={handleClick}
    >
      {/* Top row: source icon, severity, headline */}
      <div className="flex items-start gap-1.5">
        <SourceIcon source={alert.source} className="w-3 h-3 text-zinc-600 flex-shrink-0 mt-0.5" />
        <span className={`text-[9px] font-bold tracking-wider ${sev.text} flex-shrink-0 mt-px`}>
          {sev.label}
        </span>
        {isProposal && alert.tradeIdea && (
          <span className="flex-shrink-0 mt-0.5">
            {alert.tradeIdea.direction === 'long'
              ? <TrendingUp className="w-3 h-3 text-[var(--fintheon-accent)]" />
              : alert.tradeIdea.direction === 'short'
                ? <TrendingDown className="w-3 h-3 text-zinc-400" />
                : null
            }
          </span>
        )}
        <p className={`flex-1 min-w-0 text-[11px] leading-snug font-medium line-clamp-2 ${
          isProposal ? 'text-[var(--fintheon-text)]' :
          alert.severity === 'critical' ? 'text-orange-300' :
          isHigh ? 'text-red-300' : 'text-zinc-300'
        } group-hover:text-white transition-colors`}>
          {isProposal ? (
            <a className="cursor-pointer">{alert.headline}</a>
          ) : (
            <a href={alert.url} target="_blank" rel="noopener noreferrer">{alert.headline}</a>
          )}
        </p>

        {/* Cyclical badge — top right */}
        {alert.cyclical && alert.cyclical !== 'Neutral' && (
          <span className={`flex-shrink-0 text-[7px] font-bold tracking-[0.12em] uppercase px-1 py-px border ${
            alert.cyclical === 'Cyclical'
              ? 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/70'
              : 'border-violet-500/30 text-violet-400/70'
          }`}>
            {alert.cyclical === 'Cyclical' ? 'CYC' : 'CTR'}
          </span>
        )}
      </div>

      {/* Bottom row: meta + CTAs */}
      <div className="flex items-center gap-1.5 mt-1 ml-[18px]">
        <span className="text-[9px] text-zinc-600">{timeAgo(alert.publishedAt)}</span>
        {alert.authorHandle && (
          <span className="text-[9px] text-zinc-600">@{alert.authorHandle}</span>
        )}
        {(() => {
          const dir = inferDirection(alert);
          return <span className={`text-[9px] font-semibold ${dir === 'Bullish' ? 'text-emerald-500' : 'text-red-400'}`}>{dir === 'Bullish' ? '▲' : '▼'} {dir}</span>;
        })()}
        <span className="text-[9px] text-zinc-500 tabular-nums">
          {alert.instrument ? `${alert.instrument} ` : ''}{alert.pointRange != null && alert.pointRange !== 0 ? `±${Math.abs(alert.pointRange).toFixed(0)} pts` : '0-5 pts'}
        </span>
        {isProposal && alert.tradeIdea?.riskRewardRatio && (
          <span className="text-[9px] text-zinc-500">R/R {alert.tradeIdea.riskRewardRatio.toFixed(1)}:1</span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* CTAs */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isProposal ? (
            <>
              {onApprove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onApprove(alert); }}
                  className="p-0.5 text-emerald-600 hover:text-emerald-400 transition-colors"
                  title="Approve"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              {onDeny && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeny(alert.id); }}
                  className="p-0.5 text-red-600 hover:text-red-400 transition-colors"
                  title="Deny"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <>
              {onChat && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChat(alert); }}
                  className="p-0.5 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors"
                  title="Chat"
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
              )}
              {alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors"
                  title="Open"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
              className="p-0.5 text-zinc-700 hover:text-red-400 transition-colors"
              title="Dismiss"
            >
              <span className="text-[10px] font-bold">&times;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function CompactRiskFlowCard(props: CompactRiskFlowCardProps) {
  const variant = props.variant ?? 'minimal';
  if (variant === 'mini') return <MiniCard {...props} />;
  return <MinimalCard {...props} />;
}
