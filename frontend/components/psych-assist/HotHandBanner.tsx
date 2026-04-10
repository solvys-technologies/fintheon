// [claude-code 2026-03-22] Source of Truth fusion — 48h hot hand overconfidence banner
import { AlertTriangle } from "lucide-react";

interface HotHandBannerProps {
  hoursRemaining: number;
  winAmount: number;
  onDismiss?: () => void;
}

export function HotHandBanner({
  hoursRemaining,
  winAmount,
  onDismiss,
}: HotHandBannerProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--fintheon-accent)]/5 border-b border-[var(--fintheon-accent)]/15">
      <AlertTriangle
        size={11}
        className="text-[var(--fintheon-accent)] shrink-0"
      />
      <span className="text-[9px] font-mono text-[var(--fintheon-accent)]/70 flex-1">
        Hot hand flag active ({Math.round(hoursRemaining)}h remaining) -- $
        {winAmount.toLocaleString()} win triggered 48h overconfidence watch.
        Verify thesis quality before entry. Standard sizing only.
      </span>
      <span className="text-[7px] font-mono text-[var(--fintheon-accent)]/30 shrink-0">
        C4
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-[8px] font-mono text-[var(--fintheon-text)]/20 hover:text-[var(--fintheon-text)]/40 shrink-0"
        >
          x
        </button>
      )}
    </div>
  );
}
