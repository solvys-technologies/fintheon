// [claude-code 2026-04-25] S42-T6: Shared "Ask about this" affordance for output cards.
//   Hover-revealed icon button. On click, dispatches `fintheon:open-chat-with-context`
//   which (a) opens the sliding chat panel and (b) sends a Harper message with the
//   surface label + payload. Existing surface-context wiring on harper-handler picks
//   it up via the inline prompt + the `fintheon:current-surface` localStorage key.
import { MessageSquare } from "lucide-react";

export interface AskAboutThisProps {
  surface: string;
  payload: Record<string, unknown>;
  /** Optional explicit label, used in the auto-prompt and tooltip. */
  label?: string;
  /** Position in card header — set to false to render statically (no hover-reveal). */
  hoverReveal?: boolean;
  className?: string;
  size?: number;
}

export function AskAboutThis({
  surface,
  payload,
  label,
  hoverReveal = true,
  className,
  size = 12,
}: AskAboutThisProps) {
  const tooltip = label ? `Ask about ${label}` : "Ask about this";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      localStorage.setItem("fintheon:current-surface", surface);
    } catch {
      /* no-op */
    }
    window.dispatchEvent(
      new CustomEvent("fintheon:open-chat-with-context", {
        detail: { surface, payload, label },
      }),
    );
  };

  const baseClass =
    "inline-flex items-center justify-center rounded-md border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/60 transition-colors";

  const reveal = hoverReveal
    ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
    : "";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tooltip}
      aria-label={tooltip}
      className={`${baseClass} ${reveal} ${className ?? ""}`}
      style={{
        width: size + 12,
        height: size + 12,
        flexShrink: 0,
      }}
    >
      <MessageSquare size={size} strokeWidth={2} />
    </button>
  );
}
