// [claude-code 2026-05-05] S59-T3: Mobile AgentHealthDashboard — stacked agent rows, tap to expand.
// Uses inline styles with CSS variables matching the mobile design system.
import { useState, useEffect, useCallback, useRef } from "react";

interface AgentHealthEntry {
  agentId: string;
  role: string;
  soulLoaded: boolean;
  soulVersion: number | null;
  nativeHomeIntact: boolean;
  reflectScore: number | null;
  reflectLastRun: string | null;
  memoryCount: number;
  gepaLastRun: string | null;
  gepaOpenPrs: number;
  personaHealth: "green" | "amber" | "red";
}

interface Response {
  timestamp: string;
  agents: AgentHealthEntry[];
}

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 60_000;

const AGENT_LABELS: Record<string, string> = {
  harper: "HARPER",
  oracle: "ORACLE",
  feucht: "FEUCHT",
  consul: "CONSUL",
  herald: "HERALD",
};

const STATUS_DOT: Record<string, string> = {
  green: "#34D399",
  amber: "#FBBF24",
  red: "#EF4444",
};

const STATUS_BG: Record<string, string> = {
  green: "rgba(52,211,153,0.10)",
  amber: "rgba(251,191,36,0.10)",
  red: "rgba(239,68,68,0.10)",
};

const STATUS_BORDER: Record<string, string> = {
  green: "rgba(52,211,153,0.25)",
  amber: "rgba(251,191,36,0.25)",
  red: "rgba(239,68,68,0.25)",
};

const STATUS_LABEL: Record<string, string> = {
  green: "INTACT",
  amber: "PARTIAL",
  red: "MISSING",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "never";
  if (diff < 60_000) return "<1m";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

interface AgentRowProps {
  agent: AgentHealthEntry;
}

function AgentRow({ agent }: AgentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const label = AGENT_LABELS[agent.agentId] ?? agent.agentId;
  const s = STATUS_DOT[agent.personaHealth];
  const sb = STATUS_BG[agent.personaHealth];
  const sbr = STATUS_BORDER[agent.personaHealth];
  const sl = STATUS_LABEL[agent.personaHealth];

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${sbr}`,
        borderRadius: 8,
        background: "var(--surface)",
        overflow: "hidden",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: s,
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 13,
                letterSpacing: "0.08em",
                color: "var(--text-primary)",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-disabled)",
              }}
            >
              {agent.role}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: sb,
              border: `1px solid ${sbr}`,
              color: s,
              letterSpacing: "0.06em",
            }}
          >
            {sl}
          </span>

          {agent.reflectScore !== null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-secondary)",
              }}
            >
              {agent.reflectScore.toFixed(2)}
            </span>
          )}

          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-disabled)",
            }}
          >
            {agent.memoryCount}m
          </span>

          <span
            style={{
              color: "var(--text-disabled)",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 200ms ease",
              fontSize: 10,
            }}
          >
            &#9660;
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <DetailRow label="SOUL Load" value={agent.soulLoaded ? "Loaded" : "Failed"} />
          <DetailRow
            label="Native Home"
            value={
              !agent.soulLoaded
                ? "N/A"
                : agent.nativeHomeIntact
                  ? "All fields present"
                  : "Missing fields"
            }
          />
          <DetailRow
            label="REFLECT"
            value={
              agent.reflectScore !== null
                ? `${agent.reflectScore.toFixed(3)}`
                : "No data"
            }
            secondary={agent.reflectLastRun ? timeAgo(agent.reflectLastRun) : undefined}
          />
          <DetailRow
            label="GEPA"
            value={`${agent.gepaOpenPrs} open`}
            secondary={
              agent.gepaLastRun ? timeAgo(agent.gepaLastRun) : "never"
            }
          />
          <DetailRow label="Memories" value={`${agent.memoryCount} stored`} />
          {agent.soulVersion && (
            <DetailRow label="SOUL Version" value={`v${agent.soulVersion}`} />
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.06em",
          color: "var(--text-disabled)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-primary)",
          }}
        >
          {value}
        </span>
        {secondary && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--text-disabled)",
            }}
          >
            {secondary}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentHealthDashboard() {
  const [data, setData] = useState<AgentHealthEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/apparatus/agent-health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Response = await res.json();
      if (mountedRef.current) {
        setData(json.agents);
        setLastUpdated(json.timestamp);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "fetch failed");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const interval = setInterval(fetchData, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  const green = data?.filter((a) => a.personaHealth === "green").length ?? 0;
  const amber = data?.filter((a) => a.personaHealth === "amber").length ?? 0;
  const red = data?.filter((a) => a.personaHealth === "red").length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Status summary + refresh */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#34D399",
            }}
          >
            {green} OK
          </span>
          {amber > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "#FBBF24",
              }}
            >
              {amber} WARN
            </span>
          )}
          {red > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "#EF4444",
              }}
            >
              {red} FAIL
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.08em",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            padding: "4px 10px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.5 : 1,
            WebkitTapHighlightColor: "transparent",
            minHeight: 32,
          }}
        >
          {loading ? "[...]" : "[REFRESH]"}
        </button>
      </div>

      {lastUpdated && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-disabled)",
          }}
        >
          Updated {timeAgo(lastUpdated)} ago
        </span>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            background: "rgba(239,68,68,0.06)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#EF4444",
            }}
          >
            [ERROR: {error}]
          </span>
        </div>
      )}

      {loading && !data && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-disabled)",
            textAlign: "center",
            padding: 24,
            letterSpacing: "0.1em",
          }}
        >
          [LOADING...]
        </span>
      )}

      {data &&
        data.map((agent) => <AgentRow key={agent.agentId} agent={agent} />)}
    </div>
  );
}
