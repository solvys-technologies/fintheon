// [claude-code 2026-05-05] Modernized: no background/borders, fading rulers between sections,
// allowlist removed (handles live in Refinement source-accounts tab), doctoring fused in.
// [claude-code 2026-04-29] S53-T4B: Source Policy Panel — leak sentinel counters and continuity health.
import { useEffect } from "react";
import { useIngestActivity } from "../../hooks/useIngestActivity";

const HEADER: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fintheon-accent)",
  marginBottom: 12,
};

const FADING_RULER: React.CSSProperties = {
  width: "100%",
  height: 1,
  margin: "10px 0",
  background:
    "linear-gradient(to right, rgba(199,159,74,0.18), transparent 80%)",
};

const VERTICAL_FADING_RULER: React.CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  background:
    "linear-gradient(to bottom, rgba(199,159,74,0.18), transparent 80%)",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: "var(--fintheon-text)",
  marginBottom: 6,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  opacity: 0.65,
};

const METRIC_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "2px 0",
};

const METRIC_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  color: "var(--fintheon-muted)",
  minWidth: 80,
};

const METRIC_VALUE: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "var(--font-data)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

export function SourcePolicyPanel() {
  const { leak_sentinel, continuity, loading, refetch } = useIngestActivity();

  useEffect(() => {
    void refetch();
  }, []);

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={HEADER}>Source Policy</div>
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "var(--fintheon-muted)",
          }}
        >
          {loading ? "LOADING" : "LIVE"}
        </span>
      </div>

      {/* Leak Sentinel — inline metrics with vertical fading dividers */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={METRIC_LABEL}>REJECTED</span>
          <span
            style={{
              ...METRIC_VALUE,
              color:
                leak_sentinel.rejected_non_allowlisted > 0
                  ? "#ef4444"
                  : "var(--fintheon-text)",
            }}
          >
            {leak_sentinel.rejected_non_allowlisted}
          </span>
        </span>
        <span style={VERTICAL_FADING_RULER} />
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={METRIC_LABEL}>BLOCKED</span>
          <span style={METRIC_VALUE}>{leak_sentinel.blocked_before_feed}</span>
        </span>
        <span style={VERTICAL_FADING_RULER} />
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={METRIC_LABEL}>UNEXPECTED</span>
          <span
            style={{
              ...METRIC_VALUE,
              color:
                leak_sentinel.unexpected_feed_insertions > 0
                  ? "#ef4444"
                  : "var(--fintheon-text)",
            }}
          >
            {leak_sentinel.unexpected_feed_insertions}
          </span>
        </span>
      </div>
      {leak_sentinel.last_leak_detail && (
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: "#ef4444",
            opacity: 0.7,
          }}
        >
          Last: {leak_sentinel.last_leak_detail}
        </div>
      )}

      <div style={FADING_RULER} />

      {/* Continuity Health */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={METRIC_LABEL}>ECON</span>
          <span
            style={{
              ...METRIC_VALUE,
              color: continuity.econ_stalled
                ? "#ef4444"
                : "var(--fintheon-text)",
            }}
          >
            {continuity.econ_received}/{continuity.econ_expected}
          </span>
          <span
            style={{
              fontSize: 9,
              color: continuity.econ_stalled
                ? "#ef4444"
                : "var(--fintheon-muted)",
            }}
          >
            {continuity.econ_stalled ? "stalled" : "flowing"}
          </span>
        </span>
        <span style={VERTICAL_FADING_RULER} />
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={METRIC_LABEL}>COMMENTARY</span>
          <span
            style={{
              ...METRIC_VALUE,
              color: continuity.commentary_stalled
                ? "#ef4444"
                : "var(--fintheon-text)",
            }}
          >
            {continuity.commentary_received}/{continuity.commentary_expected}
          </span>
          <span
            style={{
              fontSize: 9,
              color: continuity.commentary_stalled
                ? "#ef4444"
                : "var(--fintheon-muted)",
            }}
          >
            {continuity.commentary_stalled ? "stalled" : "flowing"}
          </span>
        </span>
      </div>

      <div style={FADING_RULER} />
    </div>
  );
}
