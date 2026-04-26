// [claude-code 2026-04-25] S42-T4: switch-on-kind renderer for ArtifactPane / mobile ArtifactSheet
import { ExternalLink } from "lucide-react";
import { EmbeddedBrowserFrame } from "../layout/EmbeddedBrowserFrame";
import { ReportViewer } from "./ReportViewer";
import type { ArtifactPayload } from "./artifactTypes";

interface ArtifactSlotProps {
  artifact: ArtifactPayload;
  onClose: () => void;
}

export function ArtifactSlot({ artifact, onClose }: ArtifactSlotProps) {
  if (artifact.kind === "tradingview") {
    const symbol = encodeURIComponent(artifact.payload.symbol);
    const interval = artifact.payload.interval ?? "D";
    const src = `https://www.tradingview.com/chart/?symbol=${symbol}&interval=${interval}`;
    return (
      <EmbeddedBrowserFrame
        title={`TradingView ${artifact.payload.symbol}`}
        src={src}
      />
    );
  }

  if (artifact.kind === "browserbase") {
    return (
      <EmbeddedBrowserFrame
        title="Browserbase session"
        src={artifact.payload.sessionUrl}
      />
    );
  }

  if (artifact.kind === "report") {
    return (
      <div className="h-full overflow-y-auto p-4">
        <ReportViewer html={artifact.payload.html} onClose={onClose} />
      </div>
    );
  }

  // citation
  const { title, snippet, source, url } = artifact.payload;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] p-4">
        {source && (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70 mb-2">
            {source}
          </div>
        )}
        <h3 className="text-sm font-semibold text-[var(--fintheon-text)] mb-3">
          {title}
        </h3>
        {snippet && (
          <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {snippet}
          </p>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--fintheon-accent)] hover:underline"
          >
            <ExternalLink size={12} />
            <span>Open source</span>
          </a>
        )}
      </div>
    </div>
  );
}
