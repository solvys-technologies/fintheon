// [claude-code 2026-04-29] S53-T4B: Operator Timeline — "Everything" view showing
// every poll attempt with decision, reason, and timestamp. Auto-refreshes every 30s.
// Solvys materials: frosted-glass container, thin gold separators, monospace data,
// tabular numbers for timestamps, muted labels quieter than values.

import {
  useIngestActivity,
  type IngestLedgerEntry,
} from "../../hooks/useIngestActivity";

const DECISION_COLOR: Record<string, string> = {
  accepted: "#22c55e",
  polled: "#60a5fa",
  blocked_by_policy: "#ef4444",
  dropped_before_feed: "#f97316",
  rate_limited: "#eab308",
  errored: "#dc2626",
};

const DECISION_LABEL: Record<string, string> = {
  accepted: "ACCEPTED",
  polled: "POLLED",
  blocked_by_policy: "BLOCKED",
  dropped_before_feed: "DROPPED",
  rate_limited: "LIMITED",
  errored: "ERROR",
};

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
  marginBottom: 6,
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "2px 0",
  borderBottom: "1px solid rgba(199, 159, 74, 0.06)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
};

const COL_TIME: React.CSSProperties = {
  color: "var(--fintheon-muted)",
  width: 56,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const COL_DECISION: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  width: 60,
  flexShrink: 0,
};

const COL_SOURCE: React.CSSProperties = {
  color: "var(--fintheon-text)",
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.72,
};

const COL_REASON: React.CSSProperties = {
  color: "var(--fintheon-muted)",
  fontSize: 9,
  maxWidth: 170,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flexShrink: 1,
};

function LedgerRow({ entry }: { entry: IngestLedgerEntry }) {
  const color = DECISION_COLOR[entry.decision] ?? "#71717a";
  const label = DECISION_LABEL[entry.decision] ?? entry.decision;
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
  });

  return (
    <div style={ROW}>
      <span style={COL_TIME}>{time}</span>
      <span style={{ ...COL_DECISION, color }}>{label}</span>
      <span style={COL_SOURCE}>{entry.source}</span>
      <span style={COL_REASON}>{entry.reason}</span>
    </div>
  );
}

export function OperatorTimeline() {
  const { entries, loading, error, refetch } = useIngestActivity();

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
        <div style={HEADER}>Everything Timeline</div>
        <button
          onClick={refetch}
          style={{
            background: "transparent",
            border: "1px solid rgba(199, 159, 74, 0.14)",
            color: "var(--fintheon-accent)",
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            padding: "1px 6px",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          REFRESH
        </button>
      </div>

      {loading ? (
        <div
          style={{
            padding: "6px 0",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--fintheon-muted)",
          }}
        >
          [LOADING...]
        </div>
      ) : error ? (
        <div
          style={{
            padding: "6px 0",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "#ef4444",
          }}
        >
          [ERROR: {error}]
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: "6px 0",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--fintheon-muted)",
          }}
        >
          No ingest activity recorded
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          <div
            style={{
              ...ROW,
              borderBottom: "1px solid rgba(199, 159, 74, 0.14)",
              fontWeight: 600,
              fontSize: 9,
              color: "var(--fintheon-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            <span style={COL_TIME}>Time</span>
            <span style={COL_DECISION}>Decision</span>
            <span style={COL_SOURCE}>Source</span>
            <span style={COL_REASON}>Reason</span>
          </div>
          {entries.map((e) => (
            <LedgerRow key={`${e.id}-${e.timestamp}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
