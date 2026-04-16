// [claude-code 2026-04-16] T7: Compact chronological timeline of catalyst events
import { motion } from "framer-motion";
import { useCatalysts, type Catalyst } from "../../hooks/useCatalysts";

const sentimentDot: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
};

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

  // Sort chronologically (newest first)
  const sorted = [...catalysts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

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

  if (sorted.length === 0) {
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
          [NO EVENTS]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        TIMELINE
      </div>
      {sorted.slice(0, 30).map((c) => (
        <TimelineEntry key={c.id} catalyst={c} />
      ))}
    </div>
  );
}
