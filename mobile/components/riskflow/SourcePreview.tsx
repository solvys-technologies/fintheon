// [claude-code 2026-04-19] Mobile source preview — mirrors the desktop component.
//   Flat-border surface (no glass), bucket label + author handle header,
//   scraped body text, YouTube + open-original CTAs in the footer. Tap on
//   videoUrl opens the YouTube app via window.open (iOS/Android native route).
import type { MobileRiskFlowAlert } from "../../contexts/RiskFlowContext";
import { bucketOf } from "../../lib/source-buckets";
import { timeAgo } from "@frontend/lib/time-utils";

interface SourcePreviewProps {
  alert: MobileRiskFlowAlert;
}

export function SourcePreview({ alert }: SourcePreviewProps) {
  const bucket = bucketOf({
    source: alert.source,
    riskType: alert.riskType,
    submittedBy: alert.submittedBy,
  });

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface-raised)",
        padding: "10px 12px",
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ color: "var(--accent)" }}>{bucket}</span>
        <span style={{ color: "var(--text-disabled)" }}>·</span>
        <span>{timeAgo(alert.publishedAt)}</span>
        {alert.authorHandle && (
          <>
            <span style={{ color: "var(--text-disabled)" }}>·</span>
            <span>@{alert.authorHandle}</span>
          </>
        )}
      </div>

      {/* Body — scraped text; fall back to title */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-primary)",
          lineHeight: 1.55,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {alert.content || alert.title}
      </p>

      {/* Footer */}
      {(alert.url || alert.videoUrl) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
          }}
        >
          {alert.videoUrl && (
            <a
              href={alert.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#ff4d4d",
                textDecoration: "none",
              }}
            >
              [YOUTUBE]
            </a>
          )}
          {alert.url && alert.url !== alert.videoUrl && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--interactive)",
                textDecoration: "none",
              }}
            >
              [OPEN ORIGINAL]
            </a>
          )}
        </div>
      )}
    </div>
  );
}
