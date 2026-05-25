// [claude-code 2026-05-16] S68-T5: Hover/active state polish

import type { ThemeStatus } from "../../hooks/useThemes";
import { ThemeStatusBadge } from "./ThemeStatusBadge";
import DriftBubble from "./DriftBubble";
import type { DriftBubbleData } from "./DriftBubble";

interface ThemeHeaderProps {
  name: string;
  ipv: number;
  status: ThemeStatus;
  drift?: DriftBubbleData;
}

export function ThemeHeader({ name, ipv, status, drift }: ThemeHeaderProps) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-[var(--fintheon-accent)]/3">
      <h3 className="text-sm font-semibold text-[var(--fintheon-text)] truncate group-hover:text-[var(--fintheon-accent)] transition-colors duration-150">
        {name}
      </h3>
      <span
        className="text-[11px] font-mono tabular-nums shrink-0"
        style={{ color: "var(--fintheon-accent)" }}
      >
        IPV: {ipv.toFixed(2)}
      </span>
      <ThemeStatusBadge status={status} />
      {drift && <DriftBubble drift={drift} />}
    </div>
  );
}
