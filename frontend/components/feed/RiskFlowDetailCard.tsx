// [claude-code 2026-04-25] S38: Generate Note CTA now produces a structured detailed
//   note — original headline link + ≤200-char summary + bullish/bearish/neutral read
//   conditioned on the user's selected instrument (localStorage `fintheon:selected-instrument`,
//   default /ES). Renders link + summary + direction badge in the expanded card.
// [claude-code 2026-04-10] S9-T2: Refactored to use AlertCardBase — detail variant
// [claude-code 2026-04-19] Surface-gated SourcePreview — expanded card now shows
//   scraped source body with YouTube + Open-original CTAs (surface="full" or
//   "timeline"). Mini surfaces still render the legacy footer link row only.
import { useState, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { useToast } from "../../contexts/ToastContext";
import { BeatMissBadge } from "./BeatMissBadge";
import { DetailFooter } from "./DetailFooter";
import { AlertCardBase } from "./AlertCardBase";
import { YouTubeLogo } from "../../lib/shared-icons";
import { timeAgo } from "../../lib/time-utils";
import { linkifyText } from "../../lib/linkify";
import { SourcePreview } from "./SourcePreview";

export type RiskFlowDetailSurface = "full" | "timeline" | "mini";

interface DetailedNote {
  source_url: string | null;
  summary: string;
  direction: "bullish" | "bearish" | "neutral";
  instrument: string;
}

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

function readSelectedInstrument(): string {
  try {
    return localStorage.getItem("fintheon:selected-instrument") || "/ES";
  } catch {
    return "/ES";
  }
}

function directionLabel(
  d: DetailedNote["direction"],
  instrument: string,
): string {
  const head =
    d === "bullish" ? "Bullish" : d === "bearish" ? "Bearish" : "Neutral";
  return `${head} for ${instrument}`;
}

interface RiskFlowDetailCardProps {
  alert: RiskFlowAlert;
  seen?: boolean;
  onGenerateNote?: (itemId: string) => void;
  onNotRelevant?: (id: string, reason?: string) => void;
  /** Which surface this card is rendering in. Drives SourcePreview visibility. */
  surface?: RiskFlowDetailSurface;
}

export function RiskFlowDetailCard({
  alert,
  seen,
  onGenerateNote,
  onNotRelevant,
  surface = "mini",
}: RiskFlowDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailedNote, setDetailedNote] = useState<DetailedNote | null>(null);
  const [generating, setGenerating] = useState(false);
  const { addToast } = useToast();
  const hasEconData = alert.econData && alert.econData.beatMiss;
  const showSourcePreview = surface === "full" || surface === "timeline";

  const handleGenerateNote = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const rawId = alert.id.replace(/^backend-/, "");
      const instrument = readSelectedInstrument();
      setGenerating(true);
      addToast("Generating analyst note...", "info");
      try {
        const res = await fetch(
          `${API_BASE}/api/riskflow/${encodeURIComponent(rawId)}/generate-note`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instrument }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Partial<DetailedNote>;
        if (
          typeof data.summary === "string" &&
          (data.direction === "bullish" ||
            data.direction === "bearish" ||
            data.direction === "neutral")
        ) {
          setDetailedNote({
            source_url: data.source_url ?? alert.url ?? null,
            summary: data.summary,
            direction: data.direction,
            instrument: data.instrument ?? instrument,
          });
        }
        if (onGenerateNote) onGenerateNote(rawId);
      } catch (err) {
        console.warn("[RiskFlow] Generate note failed:", err);
        addToast("Note generation failed", "error");
      } finally {
        setGenerating(false);
      }
    },
    [alert.id, alert.url, onGenerateNote, addToast],
  );

  return (
    <AlertCardBase
      alert={alert}
      variant="detail"
      seen={seen}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      onNotRelevant={onNotRelevant}
      className={`${
        expanded
          ? "border-b border-[var(--fintheon-accent)]/30"
          : "border-b border-zinc-800/60 hover:border-[var(--fintheon-accent)]/30"
      } ${seen ? "opacity-70" : ""}`}
      style={
        expanded
          ? ({
              "--tw-ring-color":
                "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
            } as React.CSSProperties)
          : undefined
      }
      expandedContent={
        <>
          <div className="px-4 py-3 border-t border-zinc-800/40 bg-[#000]/90">
            {/* [claude-code 2026-04-25] S35: Hero image + source-link rail. Image is
                best-effort (RSS enclosure / og:image) — hides on load failure so a
                broken image never wedges the card. Source link below opens in a new
                tab and is the primary handoff to the original article. */}
            {alert.imageUrl && (
              <a
                href={alert.url ?? alert.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block mb-3 border border-zinc-800/60 overflow-hidden bg-[var(--fintheon-bg)]"
              >
                <img
                  src={alert.imageUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (
                      e.currentTarget.parentElement as HTMLElement
                    ).style.display = "none";
                  }}
                  className="w-full max-h-48 object-cover"
                />
              </a>
            )}
            {/* 1. Agent Note (or Generate CTA) */}
            {detailedNote ? (
              <div className="border border-zinc-800/60 px-3 py-2.5 mb-3 bg-[var(--fintheon-bg)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">
                    Oracle
                  </span>
                </div>
                {detailedNote.source_url && (
                  <a
                    href={detailedNote.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block mb-1.5 text-[11px] text-[var(--fintheon-accent)] hover:underline truncate"
                  >
                    {alert.headline}
                  </a>
                )}
                <p className="text-[11px] text-[var(--fintheon-text)] leading-relaxed mb-1.5">
                  {detailedNote.summary}
                </p>
                <span
                  className={`inline-block text-[9px] font-bold tracking-[0.12em] uppercase ${
                    detailedNote.direction === "bullish"
                      ? "text-emerald-400"
                      : detailedNote.direction === "bearish"
                        ? "text-red-400"
                        : "text-[var(--fintheon-accent)]"
                  }`}
                >
                  {directionLabel(
                    detailedNote.direction,
                    detailedNote.instrument,
                  )}
                </span>
              </div>
            ) : alert.agentNote ? (
              <div className="border border-zinc-800/60 px-3 py-2.5 mb-3 bg-[var(--fintheon-bg)]">
                <div className="flex items-center gap-1.5 mb-1">
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
            ) : (
              <button
                onClick={handleGenerateNote}
                disabled={generating}
                className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors mb-3 px-1 disabled:opacity-50"
              >
                <span>{generating ? "Generating..." : "Generate Note +"}</span>
              </button>
            )}

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
            {!showSourcePreview &&
              alert.summary &&
              alert.summary !== alert.headline && (
                <p className="text-[11px] text-[var(--fintheon-text)]/70 leading-relaxed mb-3">
                  {linkifyText(alert.summary)}
                </p>
              )}

            {/* Source preview — scraped body + YouTube + open-original CTAs */}
            {showSourcePreview && (
              <div className="mb-3">
                <SourcePreview alert={alert} />
              </div>
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
              {/* Footer CTAs only shown on mini surfaces — SourcePreview owns
                  these links when surface is full/timeline. */}
              {!showSourcePreview && (
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
              )}
            </div>
          </div>

          {/* S3: Plain text detail footer — IV, deviation, beat/miss, sub-scores, speaker, regime */}
          <DetailFooter alert={alert} />
        </>
      }
    />
  );
}
