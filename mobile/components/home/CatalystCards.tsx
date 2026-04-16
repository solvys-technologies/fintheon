// [claude-code 2026-04-16] T7: NarrativeFlow catalyst card list — vertical stack
import { motion } from "framer-motion";
import { useCatalysts, type Catalyst } from "../../hooks/useCatalysts";

const sentimentColor = {
  bullish: "var(--success)",
  bearish: "var(--error)",
};

const severityLabel = {
  high: { text: "HIGH", color: "var(--error)" },
  medium: { text: "MED", color: "var(--warning)" },
  low: { text: "LOW", color: "var(--text-secondary)" },
};

function CatalystCard({ catalyst }: { catalyst: Catalyst }) {
  const sev = severityLabel[catalyst.severity];
  const timeStr = new Date(catalyst.date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date(catalyst.date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Header: severity + sentiment + time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: sev.color,
              fontWeight: 600,
            }}
          >
            {sev.text}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: sentimentColor[catalyst.sentiment],
            }}
          >
            {catalyst.sentiment}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            color: "var(--text-disabled)",
          }}
        >
          {dateStr} {timeStr}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-primary)",
          lineHeight: 1.4,
        }}
      >
        {catalyst.title}
      </div>

      {/* Narrative thread + tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {catalyst.narrative && (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.04em",
              color: "var(--accent)",
              textTransform: "uppercase",
            }}
          >
            {catalyst.narrative}
          </span>
        )}
        {catalyst.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.04em",
              color: "var(--text-disabled)",
              textTransform: "uppercase",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function CatalystCards() {
  const { catalysts, isLoading, error } = useCatalysts();

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
          [LOADING CATALYSTS...]
        </span>
      </div>
    );
  }

  if (error || catalysts.length === 0) {
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
          {error ? `[ERROR: ${error}]` : "[NO CATALYSTS]"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        CATALYSTS
      </div>
      {catalysts.slice(0, 20).map((c) => (
        <CatalystCard key={c.id} catalyst={c} />
      ))}
    </div>
  );
}
