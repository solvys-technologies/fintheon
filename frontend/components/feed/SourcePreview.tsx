// [claude-code 2026-04-19] Source preview block for the RiskFlow expanded card.
//   Renders scraped body text in a flat-bordered surface (no glass, per
//   feedback_no_glass_effects memory) with bucket label, author handle,
//   time ago, and an "Open original" link. If the item has a video_url,
//   a YouTube button opens the link externally.
import { ExternalLink, Youtube } from "@/components/shared/iso-icons";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { bucketOfAlert } from "../../lib/source-buckets";
import { timeAgo } from "../../lib/time-utils";
import { linkifyText } from "../../lib/linkify";

interface SourcePreviewProps {
  alert: RiskFlowAlert;
}

export function SourcePreview({ alert }: SourcePreviewProps) {
  const bucket = bucketOfAlert(alert);
  const body =
    alert.summary && alert.summary !== alert.headline ? alert.summary : null;

  return (
    <div className="border border-zinc-800/60 bg-[var(--fintheon-bg)] px-3 py-2.5">
      {/* Header row */}
      <div className="flex items-center gap-2 text-[9px] tracking-[0.12em] uppercase text-zinc-500 mb-1.5">
        <span className="text-[var(--fintheon-accent)]/80">{bucket}</span>
        <span className="text-zinc-700">&middot;</span>
        <span>{timeAgo(alert.publishedAt)}</span>
        {alert.authorHandle && (
          <>
            <span className="text-zinc-700">&middot;</span>
            <span>@{alert.authorHandle}</span>
          </>
        )}
      </div>

      {/* Body — scraped text, linkified. Fall back to headline when no summary. */}
      <p className="text-[11px] leading-relaxed text-[var(--fintheon-text)]/90 whitespace-pre-wrap break-words">
        {linkifyText(body ?? alert.headline)}
      </p>

      {/* Footer row — YouTube + Open original */}
      {(alert.url || alert.videoUrl) && (
        <div className="flex items-center gap-3 mt-2">
          {alert.videoUrl && (
            <a
              href={alert.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] text-red-500/80 hover:text-red-400 transition-colors"
              title="Open in YouTube"
            >
              <Youtube className="w-3 h-3" />
              YouTube
            </a>
          )}
          {alert.url && alert.url !== alert.videoUrl && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open original
            </a>
          )}
        </div>
      )}
    </div>
  );
}
