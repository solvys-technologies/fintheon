// [claude-code 2026-04-15] T4: Daily briefing card — truncated brief with bottom sheet expand
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SurfaceCard } from "../shared/SurfaceCard";
import { BottomSheet } from "../shared/BottomSheet";
import { useBriefing } from "../../hooks/useBriefing";

export function BriefingCard() {
  const { items, isLoading, error, refresh } = useBriefing();
  const [sheetOpen, setSheetOpen] = useState(false);

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
            display: "-webkit-box",
            WebkitLineClamp: 6,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
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

      <BottomSheet
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
      </BottomSheet>
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
