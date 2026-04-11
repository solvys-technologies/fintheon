// [claude-code 2026-03-27] S3: Plain text DetailFooter replaces SubScoreBar, expanded border-l-4 + ring
// [claude-code 2026-03-26] T4v2: Collapsible RiskFlow detail card matching Strategium AlertRow layout
// [claude-code 2026-03-29] Match RiskFlowMini: tight padding, square badges, edge-to-edge cards
// [claude-code 2026-04-10] YouTube Watch button — shown when videoUrl present (Fed speeches, etc.)
import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { inferDirection } from "../../lib/riskflow-feed";
import { useToast } from "../../contexts/ToastContext";
import { SEVERITY_CONFIG } from "../../lib/severity-config";
import { ivHeatColor } from "../../types/miroshark";
import { BeatMissBadge } from "./BeatMissBadge";
import { DetailFooter } from "./DetailFooter";

interface RiskFlowDetailCardProps {
  alert: RiskFlowAlert;
  seen?: boolean;
  onGenerateNote?: (itemId: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── SVG Source Logos ──────────────────────────────────────────────────────────

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="X"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NotionLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Notion"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.45 2.29c-.42-.326-.98-.7-2.055-.607L3.62 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.214-.14c-.093-.513.28-.886.747-.933zM2.667 1.21l13.728-1.027c1.68-.14 2.1.093 2.8.606l3.874 2.707c.466.326.606.746.606 1.26v15.7c0 .933-.326 1.493-1.494 1.586l-15.457.933c-.84.047-1.26-.093-1.727-.653L1.88 19.01c-.513-.653-.746-1.166-.746-1.86V2.89c0-.84.373-1.54 1.54-1.68z" />
    </svg>
  );
}

function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="YouTube"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function SourceIcon({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const s = source.toLowerCase();
  if (s === "notion-trade-idea" || s.includes("notion"))
    return <NotionLogo className={className} />;
  return <XLogo className={className} />;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RiskFlowDetailCard({
  alert,
  seen,
  onGenerateNote,
}: RiskFlowDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { addToast } = useToast();
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === "high" || alert.severity === "critical";
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";
  const hasEconData = alert.econData && alert.econData.beatMiss;
  const hasSubScores = !!alert.subScores;

  const handleGenerateNote = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onGenerateNote) {
        const rawId = alert.id.replace(/^backend-/, "");
        onGenerateNote(rawId);
        addToast("Generating analyst note...", "info");
      }
    },
    [alert.id, onGenerateNote, addToast],
  );

  return (
    <div
      className={`group relative overflow-hidden transition-colors ${
        expanded
          ? "border-b border-[var(--fintheon-accent)]/30 riskflow-expand-pulse"
          : "border-b border-zinc-800/60 hover:border-[var(--fintheon-accent)]/30"
      } ${isHigh ? "riskflow-fintheon-row" : ""} ${sev.label === "CRIT" ? "riskflow-severe-shimmer" : ""} ${seen ? "opacity-70" : ""}`}
      style={
        expanded
          ? ({
              "--tw-ring-color":
                "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
            } as React.CSSProperties)
          : undefined
      }
    >
      {/* ── Collapsed: headline + source icon top-right ─────────────────────── */}
      <div
        className="block px-3 pt-2.5 pb-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs leading-snug font-medium line-clamp-3 break-words ${
                alert.severity === "critical"
                  ? "text-orange-300"
                  : isHigh
                    ? "text-red-300"
                    : "text-zinc-300"
              } group-hover:text-white transition-colors`}
            >
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {alert.summary}
              </p>
            )}
          </div>

          {/* Source icon — top right */}
          <SourceIcon
            source={alert.source}
            className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5"
          />
        </div>
      </div>

      {/* ── Footer bar: time / direction / points / priority / risk-type / chevron ── */}
      <div
        className="flex items-center px-3 py-1.5 bg-zinc-900/80 border-t border-zinc-800/40 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] text-zinc-600">
          {timeAgo(alert.publishedAt)}
        </span>

        <span className="flex-1" />

        {/* Direction chevron + IV Score — right-aligned */}
        <span
          className="text-[11px] font-bold"
          style={{
            color: isBull
              ? "var(--fintheon-bullish)"
              : "var(--fintheon-bearish)",
          }}
        >
          {isBull ? "▲" : "▼"}
        </span>
        {alert.ivScore != null && (
          <span
            className="ml-1.5 text-[11px] font-mono font-bold tabular-nums"
            style={{ color: ivHeatColor(Number(alert.ivScore)) }}
          >
            IV {Number(alert.ivScore).toFixed(1)}
          </span>
        )}

        {/* Priority badge */}
        <span
          className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border`}
        >
          {sev.label}
        </span>

        {/* Risk type tag */}
        {alert.riskType && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase border border-zinc-700 text-zinc-400">
            {alert.riskType}
          </span>
        )}

        {/* Expand chevron */}
        <span className="ml-2 text-zinc-600">
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </span>
      </div>

      {/* ── Expanded content: smooth grid-template-rows transition ────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 py-3 border-t border-zinc-800/40 bg-[#000]/90">
            {/* 1. Agent Note (or Generate CTA) */}
            {alert.agentNote ? (
              <div className="border border-zinc-800/60 px-3 py-2.5 mb-3 bg-[var(--fintheon-bg)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-[var(--fintheon-accent)]" />
                  <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">
                    Oracle
                  </span>
                </div>
                <p className="text-[11px] text-[var(--fintheon-text)] leading-relaxed">
                  {alert.agentNote}
                </p>
                {alert.agentNoteGeneratedAt && (
                  <p className="text-[8px] text-zinc-600 mt-1.5 tabular-nums">
                    {timeAgo(alert.agentNoteGeneratedAt)}
                  </p>
                )}
              </div>
            ) : onGenerateNote ? (
              <button
                onClick={handleGenerateNote}
                className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors mb-3 px-1"
              >
                <span>Generate Note +</span>
              </button>
            ) : null}

            {/* 2. Econ Data — beat/miss + A/F/P (econ items only) */}
            {hasEconData && alert.econData && (
              <div className="flex items-start gap-4 mb-3">
                <BeatMissBadge
                  status={alert.econData.beatMiss!}
                  surprisePercent={alert.econData.surprisePercent}
                />
                <div className="flex items-center gap-4 text-[10px] tabular-nums">
                  {alert.econData.actual != null && (
                    <div>
                      <span className="text-[var(--fintheon-accent)]/60 uppercase tracking-wider text-[9px]">
                        Actual
                      </span>
                      <div className="text-[var(--fintheon-text)] font-medium">
                        {alert.econData.actual}
                      </div>
                    </div>
                  )}
                  {alert.econData.forecast != null && (
                    <div>
                      <span className="text-[var(--fintheon-accent)]/60 uppercase tracking-wider text-[9px]">
                        Forecast
                      </span>
                      <div className="text-[var(--fintheon-text)] font-medium">
                        {alert.econData.forecast}
                      </div>
                    </div>
                  )}
                  {alert.econData.previous != null && (
                    <div>
                      <span className="text-[var(--fintheon-accent)]/60 uppercase tracking-wider text-[9px]">
                        Previous
                      </span>
                      <div className="text-[var(--fintheon-text)] font-medium">
                        {alert.econData.previous}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* S9-T2: Deviation indicators — IV score + implied points */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {alert.econData?.beatMiss && !hasEconData && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    alert.econData.beatMiss === "beat"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : alert.econData.beatMiss === "miss"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                  }`}
                >
                  {alert.econData.beatMiss.toUpperCase()}
                </span>
              )}
              {alert.ivScore != null && (
                <span className="text-[9px] font-mono text-[var(--fintheon-muted)]/60">
                  IV {Number(alert.ivScore).toFixed(1)}
                </span>
              )}
            </div>

            {/* 3. Summary (if exists and differs from headline) */}
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[11px] text-[var(--fintheon-text)]/70 leading-relaxed mb-3">
                {alert.summary}
              </p>
            )}

            {/* 5. Tags + Author + Source link */}
            <div className="flex items-center gap-2 flex-wrap">
              {alert.tags.length > 0 && (
                <div className="flex gap-1">
                  {alert.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {alert.authorHandle && (
                <span className="text-[9px] text-[var(--fintheon-accent)]/60">
                  @{alert.authorHandle}
                </span>
              )}
              <div className="ml-auto flex items-center gap-3">
                {alert.videoUrl && (
                  <a
                    href={alert.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <YouTubeLogo className="w-3 h-3" />
                    Watch
                  </a>
                )}
                {alert.url && alert.url !== alert.videoUrl && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Source
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* S3: Plain text detail footer — IV, deviation, beat/miss, sub-scores, speaker, regime */}
          <DetailFooter alert={alert} />

          {/* Fuse shimmer bar — severity-colored along expanded card footer */}
          {alert.ivScore != null && (
            <div
              className="h-[2px] w-full riskflow-fuse-shimmer"
              style={{
                background: `linear-gradient(90deg, transparent, ${ivHeatColor(Number(alert.ivScore))}60, transparent)`,
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
