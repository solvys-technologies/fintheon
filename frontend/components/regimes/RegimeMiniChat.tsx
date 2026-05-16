// [claude-code 2026-04-15] T3: Mini chat input per regime card — dispatches to sidebar chat
// [claude-code 2026-05-16] DEPRECATED — regime tracker replaced by theme-tracker (S68-T1). Kept for backward compat.
import { useState, useRef } from "react";
import { ArrowUp } from "lucide-react";
import type { TradingRegime } from "../../lib/regimes";

interface RegimeMiniChatProps {
  regime: TradingRegime;
  onExpandToSidebar?: () => void;
}

export function RegimeMiniChat({
  regime,
  onExpandToSidebar,
}: RegimeMiniChatProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    window.dispatchEvent(
      new CustomEvent("fintheon:open-chat-skill", {
        detail: {
          skillId: "regimes",
          prompt: `[Regime: ${regime.name} | ${regime.timeRange.start}-${regime.timeRange.end} ET | Bias: ${regime.bias} | Confidence: ${regime.confidence}%] ${trimmed}`,
        },
      }),
    );
    setValue("");
    setExpanded(false);
    onExpandToSidebar?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors duration-200"
      >
        Ask CAO...
      </button>
    );
  }

  return (
    <div
      className="transition-all duration-200 ease-out"
      style={{ animation: "fadeSlideIn 0.2s ease-out forwards" }}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!value.trim()) setExpanded(false);
          }}
          placeholder={`Ask about ${regime.name}...`}
          className="flex-1 bg-transparent border border-[var(--fintheon-glass-border)] px-3 py-1.5 text-xs text-[var(--fintheon-text)] placeholder-zinc-600 focus:border-[var(--fintheon-accent)]/40 focus:outline-none focus:shadow-[0_0_8px_rgba(212,175,55,0.08)] transition-all duration-200"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className={`flex items-center justify-center shrink-0 transition-all duration-300 ${
            value.trim()
              ? "bg-[var(--fintheon-accent)] text-black shadow-[0_0_12px_rgba(199,159,74,0.3)] hover:shadow-[0_0_20px_rgba(199,159,74,0.5)]"
              : "bg-[var(--fintheon-accent)]/30 text-black/50"
          }`}
          style={{ width: "26px", height: "26px" }}
          title="Send"
        >
          <ArrowUp size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
