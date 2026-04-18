// [claude-code 2026-04-19] S25: [READ MORE] + whole-body press now open the unified
//   DetailSheet (full-viewport catalyst modal with Ask CAO). Legacy SnapSheet kept as
//   fallback for when the modal context isn't mounted (e.g. edge-case remounts).
// [claude-code 2026-04-19] TP: brief preview area +25%, top padding −25%, uses the
//   unified SnapSheet instead of the one-off BriefingOverlay so every popup is sized
//   like the brief (TP standard).
// [claude-code 2026-04-16] Briefing card — haptic on overlay open
import { useHaptic } from "../../hooks/useHaptic";
import { useBriefing } from "../../hooks/useBriefing";
import { useNotificationModal } from "../../contexts/NotificationModalContext";
import { CARD_PRESS } from "../../lib/sheet-motion";
import { motion } from "framer-motion";

export function BriefingCard() {
  const { items, isLoading, error, refresh } = useBriefing();
  const vibrate = useHaptic();
  const { open } = useNotificationModal();

  const openDetail = () => {
    vibrate(10);
    open({ kind: "dailyBrief" });
  };

  if (isLoading) {
    return (
      <div style={shellStyle}>
        <Label>[LOADING BRIEF...]</Label>
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div style={shellStyle}>
        <Label>[BRIEF UNAVAILABLE]</Label>
        <button
          onClick={refresh}
          style={{
            ...ctaStyle,
            marginTop: 8,
          }}
        >
          [RETRY]
        </button>
      </div>
    );
  }

  // Plain-text preview — length scales with available space; overlay always has full.
  const fullText = items.map((i) => `**${i.title}**\n${i.detail}`).join("\n\n");
  const previewText = fullText
    .replace(/[#*_`~>]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return (
    <motion.div
      onClick={openDetail}
      whileTap={CARD_PRESS}
      role="button"
      tabIndex={0}
      aria-label="Open daily brief"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      style={{
        ...shellStyle,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Label>DAILY BRIEF</Label>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-primary)",
          lineHeight: 1.55,
          marginTop: 8,
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          whiteSpace: "pre-line",
          WebkitMaskImage:
            "linear-gradient(to bottom, black calc(100% - 32px), transparent)",
          maskImage:
            "linear-gradient(to bottom, black calc(100% - 32px), transparent)",
        }}
      >
        {previewText}
      </div>
      <span
        style={{ ...ctaStyle, alignSelf: "flex-start", marginTop: 6 }}
        aria-hidden
      >
        [READ MORE]
      </span>
    </motion.div>
  );
}

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  padding: "9px 16px 0",
};

const ctaStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--accent)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

function Label({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
