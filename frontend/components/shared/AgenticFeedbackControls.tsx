import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type FeedbackValue = "positive" | "negative";

interface AgenticFeedbackControlsProps {
  itemId: string;
  surface: string;
  className?: string;
}

const STORAGE_KEY = "fintheon:agentic-feedback:v1";

function saveFeedback(surface: string, itemId: string, value: FeedbackValue) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : {};
    records[`${surface}:${itemId}`] = {
      surface,
      itemId,
      value,
      recordedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(
      new CustomEvent("fintheon:agentic-feedback", {
        detail: { surface, itemId, value },
      }),
    );
  } catch {
    /* local feedback is best-effort */
  }
}

export function AgenticFeedbackControls({
  itemId,
  surface,
  className = "",
}: AgenticFeedbackControlsProps) {
  const [selected, setSelected] = useState<FeedbackValue | null>(null);

  const record = (value: FeedbackValue) => {
    setSelected(value);
    saveFeedback(surface, itemId, value);
  };

  return (
    <div
      className={[
        "group/agentic-feedback absolute bottom-1.5 right-1.5 z-20 flex h-9 w-16 items-end justify-end",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Agentic feedback"
    >
      <div className="flex translate-y-1 items-center gap-1 rounded-full border border-[var(--fintheon-accent)]/15 bg-black/35 px-1 py-0.5 opacity-0 backdrop-blur-sm transition-all duration-150 group-hover/agentic-feedback:translate-y-0 group-hover/agentic-feedback:opacity-75 focus-within:translate-y-0 focus-within:opacity-90">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            record("positive");
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--fintheon-text)]/55 transition-colors hover:bg-[var(--fintheon-bullish)]/10 hover:text-[var(--fintheon-bullish)]"
          aria-label="Positive feedback"
          title="Positive feedback"
        >
          <ThumbsUp
            className="h-3.5 w-3.5"
            fill={selected === "positive" ? "currentColor" : "none"}
          />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            record("negative");
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--fintheon-text)]/55 transition-colors hover:bg-[var(--fintheon-bearish)]/10 hover:text-[var(--fintheon-bearish)]"
          aria-label="Negative feedback"
          title="Negative feedback"
        >
          <ThumbsDown
            className="h-3.5 w-3.5"
            fill={selected === "negative" ? "currentColor" : "none"}
          />
        </button>
      </div>
    </div>
  );
}
