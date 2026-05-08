import type { Citation } from "./CitationChip";

export interface ArtifactPaneProps {
  artifactType: "citation" | "browser" | "tradingview" | "report" | "narrative";
  variant?: "pane" | "modal" | "sheet";
  tradingViewConfig?: { symbol: string; timeframe?: string };
  browserSessionId?: string;
  browserStatus?: "starting" | "active" | "closed";
  reportHtml?: string;
  citationSource?: { title: string; url?: string; content?: string };
  narrativeCanvasId?: string;
  isBrowserUserControlling?: boolean;
  onBrowserTakeControl?: () => void;
  onBrowserResumeAgent?: () => void;
  onPinCitation?: (citation: Citation) => void;
  onClose: () => void;
}

export function ArtifactPane({
  artifactType,
  citationSource,
  reportHtml,
  onClose,
}: ArtifactPaneProps) {
  return (
    <aside
      style={{
        width: 360,
        borderLeft: "1px solid #27272a",
        background: "#0b0b08",
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 12, color: "#d4d4d8" }}>
          Artifact · {artifactType}
        </strong>
        <button type="button" onClick={onClose} style={{ fontSize: 12 }}>
          Close
        </button>
      </div>
      {citationSource ? (
        <div style={{ fontSize: 12, color: "#e4e4e7" }}>
          <div style={{ fontWeight: 600 }}>{citationSource.title}</div>
          {citationSource.url ? (
            <a href={citationSource.url}>{citationSource.url}</a>
          ) : null}
          {citationSource.content ? <p>{citationSource.content}</p> : null}
        </div>
      ) : null}
      {reportHtml ? (
        <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
      ) : null}
    </aside>
  );
}
