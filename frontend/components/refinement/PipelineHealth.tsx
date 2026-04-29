// [claude-code 2026-04-28] S48-T3: Pipeline health stats table replacing the former
// Group Sensitivity NotchedFuse section. Renders per-pipeline rows with status dots,
// headline count, error count, last seen, and uptime %. Columns are sortable.
// [claude-code 2026-04-29] S53-T2: Added lastAppliedAt, isMutating, degradedReason
// status indicators for module-level runtime display.
import { useState, useMemo } from "react";
import type { PipelineRow } from "../../hooks/usePipelineStats";

interface Props {
  stats: PipelineRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  lastAppliedAt?: Date | null;
  isMutating?: boolean;
  degradedReason?: string | null;
}

type SortField = "headline" | "error" | "uptime";
type SortDir = "asc" | "desc";

function statusDot(s: PipelineRow): { color: string; label: string } {
  if (!s.enabled) return { color: "#52525b", label: "disabled" };
  if (s.uptimePct > 95) return { color: "#22c55e", label: "healthy" };
  if (s.uptimePct >= 50) return { color: "#c79f4a", label: "degraded" };
  return { color: "#ef4444", label: "broken" };
}

function fmtLastSeen(iso: string | null): string {
  if (!iso) return "never";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

const SORT_LABELS: Record<SortField, string> = {
  headline: "HLD",
  error: "ERR",
  uptime: "UP%",
};
const SORT_KEYS = {
  headline: "headlineCount" as const,
  error: "errorCount" as const,
  uptime: "uptimePct" as const,
};

const TH_STYLE: React.CSSProperties = {
  padding: "4px 6px",
  textAlign: "right",
  fontWeight: 600,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const TD_TEXT: React.CSSProperties = {
  padding: "5px 6px",
  textAlign: "right",
  fontFamily: "var(--font-data)",
  fontSize: 12,
  letterSpacing: "0.02em",
};

const ROW_BORDER =
  "1px solid color-mix(in srgb, var(--fintheon-accent) 6%, transparent)";
const SECTION_BORDER =
  "1px dotted color-mix(in srgb, var(--fintheon-accent) 35%, transparent)";

const STATUS_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  padding: "3px 6px",
  background:
    "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)",
  borderLeft:
    "2px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
};

export function PipelineHealth({
  stats,
  loading,
  error,
  onRetry,
  lastAppliedAt,
  isMutating,
  degradedReason,
}: Props) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    if (!sortField) return stats;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...stats].sort((a, b) => {
      const va = a[SORT_KEYS[sortField]];
      const vb = b[SORT_KEYS[sortField]];
      return (va - vb) * dir;
    });
  }, [stats, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    setSortField((prev) => (prev === field ? prev : field));
    setSortDir((d) =>
      sortField === field ? (d === "asc" ? "desc" : "asc") : "desc",
    );
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: SECTION_BORDER }}>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--fintheon-accent)",
          marginBottom: 10,
        }}
      >
        Pipeline Health
      </div>

      {degradedReason && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-bearish)" }}>degraded</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            {degradedReason}
          </span>
        </div>
      )}
      {isMutating && (
        <div style={STATUS_BAR}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--fintheon-accent)",
              animation: "fuse-shimmer 1.5s infinite",
            }}
          />
          <span style={{ color: "var(--fintheon-accent)" }}>
            applying changes...
          </span>
        </div>
      )}
      {lastAppliedAt && !isMutating && !degradedReason && (
        <div style={STATUS_BAR}>
          <span style={{ color: "var(--fintheon-accent)" }}>ok</span>
          <span style={{ color: "var(--fintheon-muted)" }}>
            last applied {lastAppliedAt.toLocaleTimeString()}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 28,
                background:
                  "color-mix(in srgb, var(--fintheon-accent) 3%, transparent)",
                animation: "fuse-shimmer 2s infinite",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--fintheon-bearish)",
            fontFamily: "var(--font-body)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={onRetry}
            style={{
              background: "transparent",
              border: "1px solid var(--fintheon-glass-border)",
              color: "var(--fintheon-accent)",
              fontSize: 10,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : stats.length === 0 ? (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--fintheon-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          No pipeline data available — backends may not be reporting
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-body)",
            fontSize: 11,
          }}
        >
          <thead>
            <tr
              style={{ borderBottom: "1px solid var(--fintheon-glass-border)" }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "4px 6px",
                  fontWeight: 600,
                  color: "var(--fintheon-muted)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Pipeline
              </th>
              <th style={{ padding: 4, width: 20 }} />
              {(["headline", "error", "uptime"] as SortField[]).map((field) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  style={{
                    ...TH_STYLE,
                    color:
                      sortField === field
                        ? "var(--fintheon-accent)"
                        : "var(--fintheon-muted)",
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {SORT_LABELS[field]}
                  {sortField === field ? (sortDir === "asc" ? " ^" : " v") : ""}
                </th>
              ))}
              <th
                style={{
                  ...TH_STYLE,
                  color: "var(--fintheon-muted)",
                  textAlign: "right",
                }}
              >
                Last
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stat) => {
              const dot = statusDot(stat);
              return (
                <tr
                  key={stat.pipeline_id}
                  style={{ borderBottom: ROW_BORDER }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--fintheon-accent) 4%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  <td
                    style={{
                      padding: "5px 6px",
                      color: "var(--fintheon-text)",
                      fontSize: 11,
                    }}
                  >
                    {stat.label}
                  </td>
                  <td style={{ padding: 4, width: 20, textAlign: "center" }}>
                    <span
                      title={dot.label}
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: dot.color,
                      }}
                    />
                  </td>
                  <td style={{ ...TD_TEXT, color: "var(--fintheon-text)" }}>
                    {stat.headlineCount}
                  </td>
                  <td
                    style={{
                      ...TD_TEXT,
                      color:
                        stat.errorCount > 0
                          ? "var(--fintheon-bearish)"
                          : "var(--fintheon-text)",
                    }}
                  >
                    {stat.errorCount}
                  </td>
                  <td style={{ ...TD_TEXT, color: dot.color }}>
                    {stat.uptimePct.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "right",
                      fontSize: 10,
                      color: "var(--fintheon-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {fmtLastSeen(stat.lastSuccessAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
