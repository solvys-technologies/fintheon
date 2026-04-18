// [claude-code 2026-04-17] Peek bar for hidden Strategium sections (RiskFlow-collapsed or Widgets-collapsed modes)
import { ChevronUp, ChevronDown } from "lucide-react";

interface StrategiumPeekBarProps {
  /** "footer" sits at the bottom (RiskFlow hidden); "header" sits at the top (widgets hidden). */
  variant: "footer" | "header";
  label: string;
  unreadCount?: number;
  onRestore: () => void;
}

export function StrategiumPeekBar({
  variant,
  label,
  unreadCount = 0,
  onRestore,
}: StrategiumPeekBarProps) {
  const hasUnread = unreadCount > 0;
  const shimmerClass = hasUnread ? "fintheon-peek-shimmer" : "";
  const Chevron = variant === "footer" ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onRestore}
      className={`w-full h-8 flex items-center justify-between px-3 bg-[var(--fintheon-surface)] border-t border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25 transition-colors ${shimmerClass}`}
      title={`Restore ${label}`}
      aria-label={`Restore ${label}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {hasUnread && (
          <span
            className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)]"
            aria-hidden="true"
          />
        )}
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--fintheon-text)]/60 truncate">
          {label}
          {hasUnread && (
            <span className="text-[var(--fintheon-accent)]/90 ml-2">
              · {unreadCount} unread
            </span>
          )}
        </span>
      </div>
      <Chevron className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60 shrink-0" />
    </button>
  );
}
