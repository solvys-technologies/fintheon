// [claude-code 2026-03-26] T4: RiskFlow detail card with beat/miss, sub-scores, agent notes
import React from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import type { RiskFlowAlert } from '../../lib/riskflow-feed';
import { SEVERITY_CONFIG } from '../../lib/severity-config';
import { BeatMissBadge } from './BeatMissBadge';
import { SubScoreBar } from './SubScoreBar';

interface RiskFlowDetailCardProps {
  alert: RiskFlowAlert;
  seen?: boolean;
  onGenerateNote?: (itemId: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
  if (s === 'notion-trade-idea' || s.includes('notion')) {
    return <NotionLogo className={className} />;
  }
  return <XLogo className={className} />;
}

// ── Risk type pill colors ────────────────────────────────────────────────────

const RISK_TYPE_STYLE: Record<string, string> = {
  Macro:        'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Geopolitical: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Earnings:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Technical:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Credit:       'bg-red-500/15 text-red-400 border-red-500/30',
  Liquidity:    'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Commentary:   'bg-zinc-700/50 text-zinc-400 border-zinc-700/40',
};

// ── Component ────────────────────────────────────────────────────────────────

export function RiskFlowDetailCard({ alert, seen, onGenerateNote }: RiskFlowDetailCardProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHighSev = alert.severity === 'high' || alert.severity === 'critical';
  const isBullish = alert.direction === 'Bullish';
  const isBearish = alert.direction === 'Bearish';
  const hasEconData = alert.econData && alert.econData.beatMiss;
  const hasSubScores = !!alert.subScores;
  const pts = alert.pointRange ?? 0;

  return (
    <div
      className={`group bg-[var(--fintheon-bg)] border border-zinc-800/60 px-4 py-3.5 transition-colors hover:border-[var(--fintheon-accent)]/30 ${
        seen ? 'opacity-60' : ''
      } ${isHighSev ? 'riskflow-fintheon-row' : ''}`}
    >
      {/* Row 1: Severity + Risk type pills + Time */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border ${sev.glow || ''} flex-shrink-0`}
        >
          {sev.label}
        </span>
        {alert.riskType && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium tracking-wide border rounded-sm ${
              RISK_TYPE_STYLE[alert.riskType] ?? RISK_TYPE_STYLE.Commentary
            }`}
          >
            {alert.riskType}
          </span>
        )}
        {hasEconData && (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium tracking-wide bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/20 rounded-sm">
            Econ
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">
          {timeAgo(alert.publishedAt)}
        </span>
      </div>

      {/* Headline */}
      <p
        className={`text-sm leading-snug font-medium mb-1 ${
          alert.severity === 'critical'
            ? 'text-orange-300'
            : isHighSev
              ? 'text-red-300'
              : 'text-zinc-200'
        } group-hover:text-white transition-colors`}
      >
        {alert.headline}
      </p>

      {/* Summary */}
      {alert.summary && alert.summary !== alert.headline && (
        <p className="text-[11px] text-zinc-400 line-clamp-3 mb-2.5">{alert.summary}</p>
      )}

      {/* Econ data + Sub-scores row */}
      {(hasEconData || hasSubScores) && (
        <div className="flex gap-3 mb-2.5">
          {/* Beat/Miss panel */}
          {hasEconData && alert.econData && (
            <div className="flex flex-col gap-1.5 min-w-[120px]">
              <BeatMissBadge
                status={alert.econData.beatMiss!}
                surprisePercent={alert.econData.surprisePercent}
              />
              <div className="text-[10px] text-zinc-500 tabular-nums space-y-0.5 pl-0.5">
                {alert.econData.actual != null && (
                  <div>A: <span className="text-zinc-300">{alert.econData.actual}</span></div>
                )}
                {alert.econData.forecast != null && (
                  <div>F: <span className="text-zinc-300">{alert.econData.forecast}</span></div>
                )}
                {alert.econData.previous != null && (
                  <div>P: <span className="text-zinc-300">{alert.econData.previous}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Sub-score bar */}
          {hasSubScores && alert.subScores && (
            <div className="flex-1 min-w-0 pt-1">
              <SubScoreBar subScores={alert.subScores} />
            </div>
          )}
        </div>
      )}

      {/* Agent note */}
      {alert.agentNote ? (
        <div className="border border-zinc-800/60 rounded px-3 py-2 mb-2.5 bg-zinc-900/30">
          <p className="text-[11px] text-zinc-300 italic leading-relaxed">{alert.agentNote}</p>
          {alert.agentNoteGeneratedAt && (
            <p className="text-[8px] text-zinc-600 mt-1 tabular-nums">
              {timeAgo(alert.agentNoteGeneratedAt)}
            </p>
          )}
        </div>
      ) : onGenerateNote ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onGenerateNote(alert.id);
          }}
          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors mb-2.5 group/note"
        >
          <Sparkles className="w-3 h-3 group-hover/note:text-[var(--fintheon-accent)]" />
          Generate Note +
        </button>
      ) : null}

      {/* Bottom meta row */}
      <div className="flex items-center gap-2 text-[10px]">
        <SourceIcon source={alert.source} className="w-3 h-3 text-zinc-500" />

        {/* Direction */}
        {(isBullish || isBearish) && (
          <>
            <span className={`font-semibold flex items-center gap-0.5 ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
              {isBullish ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {alert.direction}
            </span>
            <span className="text-zinc-700">&middot;</span>
          </>
        )}

        {/* Points */}
        {pts > 0 && (
          <>
            <span className="text-zinc-500 tabular-nums">
              /{alert.instrument || 'ES'} &plusmn;{pts} pts
            </span>
            <span className="text-zinc-700">&middot;</span>
          </>
        )}

        {/* Author handle */}
        {alert.authorHandle && (
          <>
            <span className="text-zinc-600">@{alert.authorHandle}</span>
            <span className="text-zinc-700">&middot;</span>
          </>
        )}

        {/* External link */}
        {alert.url && (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        )}
      </div>
    </div>
  );
}
