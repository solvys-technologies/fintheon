// [claude-code 2026-04-15] T3: Expanded toolbar content — StickyBulletin notes + antilag times
import { motion } from "framer-motion";
import { useMobileStickyBulletin } from "../../hooks/useStickyBulletin";

const MAX_NOTES_SHOWN = 3;

export function ToolbarExpanded() {
  const { tradingNotes, antilagTimes, isLoading } = useMobileStickyBulletin();

  // Split notes into lines for display
  const noteLines = tradingNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const visibleNotes = noteLines.slice(0, MAX_NOTES_SHOWN);
  const extraCount = noteLines.length - MAX_NOTES_SHOWN;

  // Format antilag times for display
  const recentAntilag = antilagTimes.slice(-5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        background: "var(--surface)",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {isLoading ? (
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
      ) : (
        <>
          {visibleNotes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {visibleNotes.map((note, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {note}
                </span>
              ))}
              {extraCount > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    color: "var(--text-secondary)",
                  }}
                >
                  [+{extraCount} MORE]
                </span>
              )}
            </div>
          )}

          {recentAntilag.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: visibleNotes.length > 0 ? 8 : 0,
              }}
            >
              {recentAntilag.map((entry, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                  }}
                >
                  {entry.time}
                </span>
              ))}
            </div>
          )}

          {visibleNotes.length === 0 && recentAntilag.length === 0 && (
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
          )}
        </>
      )}
    </motion.div>
  );
}
