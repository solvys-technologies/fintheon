// [claude-code 2026-04-15] T3: Mini chat input per regime card — dispatches to sidebar chat
import { useState, useRef } from "react";
import { Send } from "lucide-react";
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
        Ask Harper...
      </button>
    );
  }

  return (
    <div
      className="transition-all duration-200 ease-out"
      style={{ animation: "fadeSlideIn 0.2s ease-out forwards" }}
    >
      <div className="relative">
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
          className="bg-transparent border border-[var(--fintheon-glass-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--fintheon-text)] placeholder-zinc-600 focus:border-[var(--fintheon-accent)]/40 focus:outline-none focus:shadow-[0_0_8px_rgba(212,175,55,0.08)] w-full pr-7 transition-all duration-200"
        />
        <button
          onClick={handleSubmit}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-[var(--fintheon-accent)] transition-colors"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
