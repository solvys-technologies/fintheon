// [claude-code 2026-04-29] S53-T4B: Source Policy Panel — allowlist view,
// leak sentinel counters, and econ/commentary continuity health.
// Solvys materials: frosted-glass container, stat blocks with thin gold borders,
// tabular numbers for counts, muted labels quieter than values, inline status text.

import { useEffect } from "react";
import { useIngestActivity } from "../../hooks/useIngestActivity";

const CONTAINER: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px 8px",
  background: "rgba(10, 9, 5, 0.72)",
  backdropFilter: "blur(18px) saturate(1.08)",
  border: "1px solid rgba(199, 159, 74, 0.12)",
};

const HEADER: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fintheon-accent)",
  marginBottom: 8,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: "var(--fintheon-text)",
  marginBottom: 4,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--font-body)",
  opacity: 0.72,
};

const STAT_BLOCK_BASE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "3px 8px",
  border: "1px solid rgba(199, 159, 74, 0.14)",
  minWidth: 84,
  fontFamily: "var(--font-mono)",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--fintheon-muted)",
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 15,
  fontFamily: "var(--font-data)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

const STAT_SUB: React.CSSProperties = {
  fontSize: 8,
  color: "var(--fintheon-muted)",
  marginTop: 1,
};

const STATUS_LINE: React.CSSProperties = {
  marginTop: 4,
  fontSize: 9,
  fontFamily: "var(--font-mono)",
  opacity: 0.7,
};

const TAG: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "var(--font-mono)",
  padding: "1px 5px",
  lineHeight: "16px",
};

function StatBlock({
  label,
  value,
  sublabel,
  warning,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        ...STAT_BLOCK_BASE,
        borderColor: warning
          ? "rgba(239, 68, 68, 0.30)"
          : "rgba(199, 159, 74, 0.14)",
      }}
    >
      <span style={STAT_LABEL}>{label}</span>
      <span
        style={{
          ...STAT_VALUE,
          color: warning ? "#ef4444" : "var(--fintheon-text)",
        }}
      >
        {value}
      </span>
      {sublabel && <span style={STAT_SUB}>{sublabel}</span>}
    </div>
  );
}

export function SourcePolicyPanel() {
  const { leak_sentinel, continuity, allowlist, loading, refetch } =
    useIngestActivity();

  useEffect(() => {
    void refetch();
  }, []);

  return (
    <div style={CONTAINER}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
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
          {loading ? "[LOADING]" : "[LIVE]"}
        </span>
      </div>

      {/* Leak Sentinel */}
      <div style={{ marginBottom: 10 }}>
        <div style={SECTION_LABEL}>Leak Sentinel</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <StatBlock
            label="Rejected"
            value={leak_sentinel.rejected_non_allowlisted}
            sublabel="non-allowlisted"
            warning={leak_sentinel.rejected_non_allowlisted > 0}
          />
          <StatBlock
            label="Blocked"
            value={leak_sentinel.blocked_before_feed}
            sublabel="before feed"
          />
          <StatBlock
            label="Unexpected"
            value={leak_sentinel.unexpected_feed_insertions}
            sublabel="must be zero"
            warning={leak_sentinel.unexpected_feed_insertions > 0}
          />
        </div>
        {leak_sentinel.last_leak_detail && (
          <div style={{ ...STATUS_LINE, color: "#ef4444" }}>
            Last: {leak_sentinel.last_leak_detail}
          </div>
        )}
      </div>

      {/* Continuity Health */}
      <div style={{ marginBottom: 10 }}>
        <div style={SECTION_LABEL}>Continuity</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <StatBlock
            label="Econ"
            value={`${continuity.econ_received}/${continuity.econ_expected}`}
            sublabel={continuity.econ_stalled ? "stalled" : "flowing"}
            warning={continuity.econ_stalled}
          />
          <StatBlock
            label="Commentary"
            value={`${continuity.commentary_received}/${continuity.commentary_expected}`}
            sublabel={continuity.commentary_stalled ? "stalled" : "flowing"}
            warning={continuity.commentary_stalled}
          />
        </div>
        {continuity.econ_stalled && (
          <div style={{ ...STATUS_LINE, color: "#ef4444" }}>
            Econ stalled — last: {continuity.last_econ_ingest_at ?? "never"}
          </div>
        )}
        {continuity.commentary_stalled && (
          <div style={{ ...STATUS_LINE, color: "#ef4444" }}>
            Commentary stalled — last:{" "}
            {continuity.last_commentary_ingest_at ?? "never"}
          </div>
        )}
      </div>

      {/* Allowlist */}
      <div>
        <div style={SECTION_LABEL}>
          Allowlist ({allowlist?.handles.length ?? 0}h +{" "}
          {allowlist?.domains.length ?? 0}d)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {(allowlist?.handles ?? []).map((h) => (
            <span
              key={h}
              style={{
                ...TAG,
                border: "1px solid rgba(34, 197, 94, 0.25)",
                color: "#22c55e",
              }}
            >
              @{h}
            </span>
          ))}
          {(allowlist?.domains ?? []).map((d) => (
            <span
              key={d}
              style={{
                ...TAG,
                border: "1px solid rgba(96, 165, 250, 0.25)",
                color: "#60a5fa",
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
