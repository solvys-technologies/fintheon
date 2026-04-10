// [claude-code 2026-03-11] Team Dashboard — unified view of all PIC desks + context bank snapshot
import React from "react";
import { useContextBankContext } from "../../contexts/ContextBankContext";
import { DeskCard } from "./DeskCard";
import type {
  DeskReportSummary,
  AgentName,
  DeskId,
} from "../../types/context-bank";

// [claude-code 2026-03-16] Agent roster v7.9: 5-agent desk config
const DESK_CONFIG: {
  desk: DeskId;
  agent: AgentName;
  label: string;
  role: string;
}[] = [
  {
    desk: "fundamentals",
    agent: "Consul",
    label: "Consul",
    role: "Fundamentals",
  },
  { desk: "futures", agent: "Feucht", label: "Feucht", role: "Futures & Risk" },
  { desk: "pma-merged", agent: "Oracle", label: "Oracle", role: "All-Seer" },
  {
    desk: "news-sentiment",
    agent: "Herald",
    label: "Herald",
    role: "News & Sentiment",
  },
];

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function ageColor(seconds: number): string {
  if (seconds < 60) return "#4ade80"; // green
  if (seconds < 180) return "#c79f4a"; // gold
  return "#ef4444"; // red
}

function ScoreBar({
  label,
  value,
  max = 10,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    value >= 8
      ? "#ef4444"
      : value >= 6
        ? "#f97316"
        : value >= 4
          ? "#eab308"
          : "#4ade80";
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
    >
      <span style={{ color: "#f0ead6", opacity: 0.7, minWidth: 32 }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "rgba(240,234,214,0.1)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span
        style={{ color, fontWeight: 600, minWidth: 28, textAlign: "right" }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function TeamDashboard() {
  const { snapshot, deskReports, loading, error, snapshotVersion } =
    useContextBankContext();

  if (loading && !snapshot) {
    return (
      <div
        style={{
          padding: 24,
          color: "#f0ead6",
          opacity: 0.5,
          fontFamily: "monospace",
        }}
      >
        Context Bank warming up...
      </div>
    );
  }

  const reportMap = new Map<DeskId, DeskReportSummary>();
  for (const r of deskReports) {
    reportMap.set(r.desk, r);
  }

  const age = snapshot?.ageSeconds ?? 0;
  const esIV = snapshot?.ivScores?.["/ES"];
  const nqIV = snapshot?.ivScores?.["/NQ"];

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        overflow: "auto",
      }}
    >
      {/* Snapshot Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "rgba(199,159,74,0.08)",
          border: "1px solid rgba(199,159,74,0.2)",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#c79f4a" }}>Snapshot v{snapshotVersion}</span>
        <span style={{ color: "#f0ead6", opacity: 0.6 }}>
          {snapshot?.generatedAt
            ? new Date(snapshot.generatedAt).toLocaleTimeString()
            : "--"}
        </span>
        <span style={{ color: ageColor(age), fontWeight: 600 }}>
          {formatAge(age)}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 4,
            color: "#ef4444",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Desk Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {DESK_CONFIG.map((cfg) => (
          <DeskCard
            key={cfg.desk}
            agent={cfg.agent}
            role={cfg.role}
            report={reportMap.get(cfg.desk) ?? null}
          />
        ))}
      </div>

      {/* Market Context Bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
          background: "rgba(199,159,74,0.05)",
          border: "1px solid rgba(199,159,74,0.15)",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 12,
            fontFamily: "monospace",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#f0ead6" }}>
            VIX:{" "}
            <strong style={{ color: "#c79f4a" }}>
              {snapshot?.vix?.level?.toFixed(1) ?? "--"}
            </strong>{" "}
            <span style={{ opacity: 0.5 }}>
              ({snapshot?.vix?.regime ?? "--"})
            </span>
          </span>
          {esIV && (
            <span style={{ color: "#f0ead6" }}>
              /ES:{" "}
              <strong style={{ color: "#c79f4a" }}>
                {"\u00B1"}
                {esIV.points.scaledPoints}pts
              </strong>
            </span>
          )}
          {nqIV && (
            <span style={{ color: "#f0ead6" }}>
              /NQ:{" "}
              <strong style={{ color: "#c79f4a" }}>
                {"\u00B1"}
                {nqIV.points.scaledPoints}pts
              </strong>
            </span>
          )}
          <span style={{ color: "#f0ead6" }}>
            Headlines:{" "}
            <strong style={{ color: "#c79f4a" }}>
              {snapshot?.breakingHeadlines?.length ?? 0}
            </strong>
          </span>
        </div>

        {esIV && <ScoreBar label="IV" value={esIV.score} />}
        {snapshot?.systemic && (
          <ScoreBar label="Sys" value={snapshot.systemic.score} />
        )}
      </div>

      {/* Econ Surprises */}
      {snapshot?.econCalendar?.surprises &&
        snapshot.econCalendar.surprises.length > 0 && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(199,159,74,0.05)",
              border: "1px solid rgba(199,159,74,0.15)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            <div style={{ color: "#c79f4a", marginBottom: 4, fontWeight: 600 }}>
              Econ Surprises
            </div>
            {snapshot.econCalendar.surprises.map((s, i) => (
              <div key={i} style={{ color: "#f0ead6", opacity: 0.8 }}>
                <span
                  style={{
                    color: s.direction === "beat" ? "#4ade80" : "#ef4444",
                  }}
                >
                  {s.direction === "beat" ? "BEAT" : "MISS"}
                </span>{" "}
                {s.name}: {s.actual} vs {s.forecast}
              </div>
            ))}
          </div>
        )}

      {/* Trade Ideas Count */}
      {snapshot?.tradeIdeas && snapshot.tradeIdeas.active.length > 0 && (
        <div
          style={{
            padding: "6px 12px",
            background: "rgba(199,159,74,0.05)",
            border: "1px solid rgba(199,159,74,0.15)",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            color: "#f0ead6",
          }}
        >
          Active Ideas:{" "}
          <strong style={{ color: "#c79f4a" }}>
            {snapshot.tradeIdeas.active.length}
          </strong>
          {snapshot.tradeIdeas.pnlSummary.todayPnl !== undefined && (
            <span style={{ marginLeft: 12 }}>
              P&L:{" "}
              <strong
                style={{
                  color:
                    snapshot.tradeIdeas.pnlSummary.todayPnl >= 0
                      ? "#4ade80"
                      : "#ef4444",
                }}
              >
                ${snapshot.tradeIdeas.pnlSummary.todayPnl.toFixed(0)}
              </strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
