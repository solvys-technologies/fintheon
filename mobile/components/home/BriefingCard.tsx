// [claude-code 2026-04-19] TP: brief preview area +25%, top padding −25%, uses the
//   unified SnapSheet instead of the one-off BriefingOverlay so every popup is sized
//   like the brief (TP standard).
// [claude-code 2026-04-19] Pulled out of SurfaceCard per TP — brief content flows directly
//   on the dash, label + body + [READ MORE] inline. Container padding/border gone. Body
//   flex-grows to fill the empty space between the fuse row and the bottom tab bar.
// [claude-code 2026-04-16] Briefing card — haptic on overlay open
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useHaptic } from "../../hooks/useHaptic";
import remarkGfm from "remark-gfm";
import { SnapSheet } from "../shared/SnapSheet";
import { useBriefing } from "../../hooks/useBriefing";

export function BriefingCard() {
  const { items, isLoading, error, refresh } = useBriefing();
  const [sheetOpen, setSheetOpen] = useState(false);
  const vibrate = useHaptic();

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

  // Combine items into a single body string
  const fullText = items.map((i) => `**${i.title}**\n${i.detail}`).join("\n\n");

  // Plain-text preview — length scales with available space; overlay always has full.
  const previewText = fullText
    .replace(/[#*_`~>]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return (
    <>
      {/* Brief body — naked on the dash (no container, no border, no bg). */}
      <div style={shellStyle}>
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
            // Fade the bottom edge so clipped text hints at "there's more"
            WebkitMaskImage:
              "linear-gradient(to bottom, black calc(100% - 32px), transparent)",
            maskImage:
              "linear-gradient(to bottom, black calc(100% - 32px), transparent)",
          }}
        >
          {previewText}
        </div>
        <button
          onClick={() => {
            vibrate(8);
            setSheetOpen(true);
          }}
          style={{
            ...ctaStyle,
            alignSelf: "flex-start",
            marginTop: 6,
          }}
        >
          [READ MORE]
        </button>
      </div>

      <SnapSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="DAILY BRIEF"
      >
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            lineHeight: 1.6,
            padding: "0 6px",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
        </div>
      </SnapSheet>
    </>
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
