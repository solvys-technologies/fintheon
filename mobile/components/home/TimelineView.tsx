// [claude-code 2026-05-16] S67: added narrative thread, severity, and time range
//   filtering. 60s auto-refresh via useCatalysts.

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useCatalysts, type Catalyst } from "../../hooks/useCatalysts";

const sentimentDot: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
};

const SEVERITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "var(--accent, #d4af37)",
  low: "#6b7280",
};

const TIME_RANGES = [
  { key: "1h", label: "1H" },
  { key: "4h", label: "4H" },
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "all", label: "ALL" },
] as const;

const NARRATIVE_THREADS = [
  { slug: "middle-east-conflict", title: "Middle East" },
  { slug: "liquidity-credit-contraction", title: "Liquidity" },
  { slug: "ai-singularity", title: "AI" },
  { slug: "usd-jpy-carry-trade", title: "USD-JPY" },
  { slug: "trade-war", title: "Trade War" },
  { slug: "us-china-relations", title: "US-China" },
  { slug: "rate-cut-cycle", title: "Rate Cuts" },
  { slug: "trump-presidency", title: "Trump" },
  { slug: "price-stability", title: "Price Stability" },
  { slug: "maximum-employment", title: "Max Employment" },
];

function getTimeRangeCutoff(range: string): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const ms: Record<string, number> = {
    "1h": 3600000,
    "4h": 14400000,
    "1d": 86400000,
    "1w": 604800000,
  };
  return new Date(now.getTime() - (ms[range] ?? 0));
}

function TimelineEntry({ catalyst }: { catalyst: Catalyst }) {
  const time = new Date(catalyst.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Date(catalyst.date).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 0",
      }}
    >
      {/* Timeline rail */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 12,
          flexShrink: 0,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background:
              sentimentDot[catalyst.sentiment] ?? "var(--text-disabled)",
          }}
        />
        <div
          style={{
            flex: 1,
            width: 1,
            background: "var(--border)",
            marginTop: 4,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            color: "var(--text-disabled)",
            letterSpacing: "0.04em",
            marginBottom: 2,
          }}
        >
          {date} {time}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--text-primary)",
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {catalyst.title}
        </div>
        {catalyst.narrative && (
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              color: "var(--accent)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            {catalyst.narrative}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TimelineView() {
  const { catalysts, isLoading } = useCatalysts();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(
    new Set(["high"]),
  );
  const [timeRange, setTimeRange] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    return catalysts
      .filter((c) => {
        if (activeThread) {
          const threads =
            c.narrativeThreads ?? (c.narrative ? [c.narrative] : []);
          if (!threads.includes(activeThread)) return false;
        }
        if (severityFilter.size > 0 && !severityFilter.has(c.severity))
          return false;
        if (cutoff) {
          const ts = c.createdAt || c.date;
          if (ts) {
            const cardDate = new Date(ts.includes("T") ? ts : ts + "T23:59:59");
            if (cardDate < cutoff) return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [catalysts, activeThread, severityFilter, timeRange]);

  const toggleSeverity = (sev: string) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 120,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-disabled)",
            letterSpacing: "0.08em",
          }}
        >
          [LOADING TIMELINE...]
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", padding: "16px 20px" }}
    >
      {/* Header with filter toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          TIMELINE
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            color: "var(--text-disabled)",
          }}
        >
          {filtered.length} events
        </span>
      </div>

      {/* Filter toggle button */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: showFilters ? "var(--accent)" : "var(--text-disabled)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 10px",
          marginBottom: 8,
          cursor: "pointer",
          alignSelf: "flex-start",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {showFilters ? "[HIDE FILTERS]" : "[FILTERS]"}
      </button>

      {/* Filter bar */}
      {showFilters && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {/* Severity pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["high", "medium", "low"] as const).map((sev) => {
              const active = severityFilter.has(sev);
              const label =
                sev === "high"
                  ? "Critical"
                  : sev === "medium"
                    ? "Medium"
                    : "Low";
              const dotColor = SEVERITY_COLOR[sev];
              return (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: `1px solid ${active ? dotColor : "var(--border)"}`,
                    background: active ? `${dotColor}15` : "transparent",
                    fontFamily: "var(--font-data)",
                    fontSize: 9,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: active ? dotColor : "var(--text-disabled)",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: active ? dotColor : `${dotColor}40`,
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Time range pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.key}
                onClick={() => setTimeRange(tr.key)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: `1px solid ${timeRange === tr.key ? "var(--accent)" : "var(--border)"}`,
                  background:
                    timeRange === tr.key
                      ? "var(--accent-subtle, rgba(212,175,55,0.12))"
                      : "transparent",
                  fontFamily: "var(--font-data)",
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  color:
                    timeRange === tr.key
                      ? "var(--accent)"
                      : "var(--text-disabled)",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Narrative thread pills (horizontal scroll) */}
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 4,
              scrollbarWidth: "none",
            }}
          >
            <button
              onClick={() => setActiveThread(null)}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: `1px solid ${!activeThread ? "var(--accent)" : "var(--border)"}`,
                background: !activeThread
                  ? "var(--accent-subtle, rgba(212,175,55,0.12))"
                  : "transparent",
                fontFamily: "var(--font-data)",
                fontSize: 8,
                letterSpacing: "0.04em",
                color: !activeThread ? "var(--accent)" : "var(--text-disabled)",
                whiteSpace: "nowrap",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              ALL
            </button>
            {NARRATIVE_THREADS.map((t) => (
              <button
                key={t.slug}
                onClick={() =>
                  setActiveThread(activeThread === t.slug ? null : t.slug)
                }
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: `1px solid ${activeThread === t.slug ? "var(--accent)" : "var(--border)"}`,
                  background:
                    activeThread === t.slug
                      ? "var(--accent-subtle, rgba(212,175,55,0.12))"
                      : "transparent",
                  fontFamily: "var(--font-data)",
                  fontSize: 8,
                  letterSpacing: "0.04em",
                  color:
                    activeThread === t.slug
                      ? "var(--accent)"
                      : "var(--text-disabled)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 120,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              color: "var(--text-disabled)",
              letterSpacing: "0.08em",
            }}
          >
            [NO EVENTS]
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.slice(0, 30).map((c) => (
            <TimelineEntry key={c.id} catalyst={c} />
          ))}
        </div>
      )}
    </div>
  );
}
