// [claude-code 2026-04-30] Expanded RiskFlow body is distilled to media/source
// preview plus actions. Headline, IV, source, and direction live in the preview row.
import { useEffect, useState } from "react";
import { ExternalLink, MessageSquare, ThumbsDown, Video } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { BeatMissBadge } from "./BeatMissBadge";
import { openSourcePopup } from "../../lib/source-popup";
import { NothingFuse } from "../shared/NothingFuse";
import {
  alertSeverityToPalette,
  fuseScoreFromAlert,
} from "../../lib/riskflow-card-utils";
import { colorForSeverity } from "../../lib/fuse-palette";

export type RiskFlowPostSurface = "full" | "timeline" | "mini";

interface RiskFlowPostCardProps {
  alert: RiskFlowAlert;
  surface?: RiskFlowPostSurface;
  onAskAI?: (alert: RiskFlowAlert) => void;
  onNotRelevant?: (id: string, reason?: string) => void;
}

function mediaHeight(surface: RiskFlowPostSurface): string {
  return surface === "mini" ? "max-h-40" : "max-h-72";
}

export function RiskFlowPostCard({
  alert,
  surface = "mini",
  onAskAI,
  onNotRelevant,
}: RiskFlowPostCardProps) {
  const fuseScore = fuseScoreFromAlert(alert);
  const severity = alertSeverityToPalette(alert.severity);
  const severityColor = colorForSeverity(severity);
  const [footerFuseCharged, setFooterFuseCharged] = useState(false);

  useEffect(() => {
    setFooterFuseCharged(false);
    const timer = window.setTimeout(() => setFooterFuseCharged(true), 540);
    return () => window.clearTimeout(timer);
  }, [alert.id, fuseScore]);

  return (
    <article className="border-t border-[var(--fintheon-accent)]/8 bg-[rgba(5,4,2,0.42)] px-3 py-3 sm:px-4">
      <div className="min-w-0">
        {alert.videoUrl ? (
          <a
            href={alert.url ?? alert.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block overflow-hidden rounded-[6px] border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]"
          >
            <video
              src={alert.videoUrl}
              poster={alert.imageUrl ?? undefined}
              controls
              preload="metadata"
              className={`block w-full ${mediaHeight(surface)}`}
            />
          </a>
        ) : alert.imageUrl ? (
          <a
            href={alert.url ?? alert.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block overflow-hidden rounded-[6px] border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]"
          >
            <img
              src={alert.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const wrapper = e.currentTarget.parentElement;
                if (wrapper) wrapper.style.display = "none";
              }}
              className={`block w-full object-contain ${mediaHeight(surface)}`}
            />
          </a>
        ) : null}

        {alert.agentNote && (
          <div className="mt-3 rounded-[4px] border border-[var(--fintheon-accent)]/8 bg-[var(--fintheon-bg)]/55 px-3 py-2">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-text)]/35">
              Oracle
            </span>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--fintheon-text)]/75">
              {alert.agentNote}
            </p>
          </div>
        )}

        {alert.econData?.beatMiss && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BeatMissBadge
              status={alert.econData.beatMiss}
              surprisePercent={alert.econData.surprisePercent}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] tabular-nums text-[var(--fintheon-text)]/55">
              {alert.econData.actual != null && (
                <span>
                  Actual{" "}
                  <b className="font-medium text-[var(--fintheon-text)]">
                    {alert.econData.actual}
                  </b>
                </span>
              )}
              {alert.econData.forecast != null && (
                <span>
                  Forecast{" "}
                  <b className="font-medium text-[var(--fintheon-text)]">
                    {alert.econData.forecast}
                  </b>
                </span>
              )}
              {alert.econData.previous != null && (
                <span>
                  Previous{" "}
                  <b className="font-medium text-[var(--fintheon-text)]">
                    {alert.econData.previous}
                  </b>
                </span>
              )}
            </div>
          </div>
        )}

        <footer className="mt-3 flex items-center gap-2 border-t border-[var(--fintheon-accent)]/8 pt-2">
          <div className="flex min-w-[88px] flex-1 items-center gap-2">
            <NothingFuse
              value={
                footerFuseCharged
                  ? Math.min(1, Math.max(0.1, fuseScore / 10))
                  : 0
              }
              severity={severity}
              orientation="horizontal"
              thickness={4}
              segments={10}
            />
            <span
              className="shrink-0 tabular-nums"
              style={{
                fontFamily:
                  "'Doto', 'Readable Digits', var(--font-data, monospace)",
                fontSize: 11,
                fontWeight: 600,
                color: severityColor,
                lineHeight: 1,
              }}
            >
              {fuseScore.toFixed(1)}
            </span>
          </div>
          {onNotRelevant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNotRelevant(alert.id);
              }}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--fintheon-text)]/35 transition-colors hover:text-[var(--fintheon-severe)]"
              title="Not relevant — remove from feed"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          )}
          {alert.videoUrl && (
            <a
              href={alert.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--fintheon-text)]/35 transition-colors hover:text-[var(--fintheon-text)]/65"
            >
              <Video className="h-3 w-3" />
              Watch
            </a>
          )}
          {alert.url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openSourcePopup(alert.url);
              }}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--fintheon-text)]/35 transition-colors hover:text-[var(--fintheon-text)]/65"
            >
              <ExternalLink className="h-3 w-3" />
              Source only
            </button>
          )}
          {onAskAI && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAskAI(alert);
              }}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[4px] bg-transparent p-1 text-[var(--fintheon-text)]/55 transition-colors hover:text-[var(--fintheon-accent)] focus:outline-none focus:text-[var(--fintheon-accent)]"
              aria-label={`Ask AI about ${alert.headline}`}
            >
              <MessageSquare className="h-[13px] w-[13px]" />
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
