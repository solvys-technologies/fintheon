// [claude-code 2026-04-15] T2: BiasBadge — 5 heuristic bias classifications with distinct icons
// [claude-code 2026-05-16] DEPRECATED — regime tracker replaced by theme-tracker (S68-T1). Kept for backward compat.
import {
  ArrowRight,
  ArrowLeftRight,
  Merge,
  Pause,
  RefreshCw,
} from "lucide-react";
import type { TradingRegime } from "../../lib/regimes";

const BIAS_CONFIG: Record<
  TradingRegime["bias"],
  { label: string; color: string; Icon: typeof ArrowRight }
> = {
  continuation: {
    label: "Continuation",
    color: "text-[var(--fintheon-bullish)]",
    Icon: ArrowRight,
  },
  reversal: {
    label: "Reversal",
    color: "text-[var(--fintheon-bearish)]",
    Icon: ArrowLeftRight,
  },
  convergence: {
    label: "Convergence",
    color: "text-[var(--fintheon-accent)]",
    Icon: Merge,
  },
  consolidation: {
    label: "Consolidation",
    color: "text-zinc-400",
    Icon: Pause,
  },
  rotation: { label: "Rotation", color: "text-blue-400", Icon: RefreshCw },
};

export function BiasBadge({ bias }: { bias: TradingRegime["bias"] }) {
  const { label, color, Icon } = BIAS_CONFIG[bias];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase ${color}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
