// [claude-code 2026-04-16] Bulletin content — full trading notes + antilag times, rendered inside BottomSheet
import { useMobileStickyBulletin } from "../../hooks/useStickyBulletin";
import { useVixStore } from "../../hooks/useVixTicker";

export function ToolbarExpanded() {
  const { tradingNotes, antilagTimes, isLoading } = useMobileStickyBulletin();
  const vix = useVixStore();

  const noteLines = tradingNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const recentAntilag = antilagTimes.slice(-10);

  if (isLoading) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-disabled)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* VIX summary */}
      {!vix.isStale && vix.value > 0 && (
        <div>
          <SectionLabel>VIX</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                color:
                  vix.value > 30
                    ? "var(--error)"
                    : vix.value > 20
                      ? "var(--warning)"
                      : "var(--text-display)",
                lineHeight: 1,
              }}
            >
              {vix.value.toFixed(1)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              {vix.changePercent >= 0 ? "+" : ""}
              {vix.changePercent.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Trading notes — full, no truncation */}
      {noteLines.length > 0 && (
        <div>
          <SectionLabel>TRADING NOTES</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {noteLines.map((note, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                }}
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Antilag times */}
      {recentAntilag.length > 0 && (
        <div>
          <SectionLabel>ANTILAG TIMES</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recentAntilag.map((entry, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              >
                {entry.time}
              </span>
            ))}
          </div>
        </div>
      )}

      {noteLines.length === 0 && recentAntilag.length === 0 && (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-disabled)",
            }}
          >
            [NO BULLETIN DATA]
          </span>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
