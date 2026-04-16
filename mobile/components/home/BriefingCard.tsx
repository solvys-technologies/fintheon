// [claude-code 2026-04-16] Briefing card — haptic on overlay open
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useHaptic } from "../../hooks/useHaptic";
import remarkGfm from "remark-gfm";
import { SurfaceCard } from "../shared/SurfaceCard";
import { BriefingOverlay } from "./BriefingOverlay";
import { useBriefing } from "../../hooks/useBriefing";

export function BriefingCard() {
  const { items, isLoading, error, refresh } = useBriefing();
  const [sheetOpen, setSheetOpen] = useState(false);
  const vibrate = useHaptic();

  if (isLoading) {
    return (
      <SurfaceCard>
        <Label>[LOADING BRIEF...]</Label>
      </SurfaceCard>
    );
  }

  if (error || items.length === 0) {
    return (
      <SurfaceCard>
        <Label>[BRIEF UNAVAILABLE]</Label>
        <button
          onClick={refresh}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent)",
            background: "none",
            border: "none",
            padding: "8px 0 0",
            cursor: "pointer",
          }}
        >
          [RETRY]
        </button>
      </SurfaceCard>
    );
  }

  // Combine items into a single body string
  const fullText = items.map((i) => `**${i.title}**\n${i.detail}`).join("\n\n");

  // Plain-text preview (webkit-line-clamp fails with block elements from ReactMarkdown)
  const previewText =
    fullText
      .replace(/[#*_`~>]/g, "")
      .replace(/\n{2,}/g, "\n")
      .slice(0, 280) + (fullText.length > 280 ? "..." : "");

  return (
    <>
      <SurfaceCard>
        <Label>DAILY BRIEF</Label>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            lineHeight: 1.5,
            marginTop: 8,
            maxHeight: "7.5em",
            overflow: "hidden",
            whiteSpace: "pre-line",
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
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent)",
            background: "none",
            border: "none",
            padding: "8px 0 0",
            cursor: "pointer",
          }}
        >
          [READ MORE]
        </button>
      </SurfaceCard>

      <BriefingOverlay
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
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
        </div>
      </BriefingOverlay>
    </>
  );
}

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
