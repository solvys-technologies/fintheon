// [claude-code 2026-04-25] S40-P9: DualPaneShell — generalized 50/50 split-pane
// primitive extracted from TradingBrowser. Used by:
//   - TradingBrowser (existing primary/secondary platform pane)
//   - Consilium chat surface wrapping ConsulBrowserPane (new in S40)
//
// Behaviour:
//   - When `right` is null/undefined → renders left at 100%
//   - When `right` is provided → grid grid-cols-2 (50/50)
//   - Slide-in / retract via t-pane-slide-in / t-pane-retract on the right pane

import { useEffect, useRef, useState, type ReactNode } from "react";

interface DualPaneShellProps {
  left: ReactNode;
  right?: ReactNode | null;
  className?: string;
  /** Optional override for the wrapper bg (defaults to surface). */
  bgClassName?: string;
}

export function DualPaneShell({
  left,
  right,
  className = "",
  bgClassName = "bg-[var(--fintheon-surface)]",
}: DualPaneShellProps) {
  const hasRight = right != null;
  const [paneOpen, setPaneOpen] = useState(false);
  const rightRef = useRef<HTMLDivElement>(null);

  // [feedback_t_panel_slide_first_paint_raf] Drive data-open via rAF so the
  // slide-in tween runs from the closed resting state.
  useEffect(() => {
    if (!hasRight) {
      setPaneOpen(false);
      return;
    }
    const raf = requestAnimationFrame(() => setPaneOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [hasRight]);

  return (
    <div className={`h-full w-full overflow-hidden ${bgClassName} ${className}`}>
      <div
        className={`h-full ${hasRight ? "grid grid-cols-2 gap-0" : ""}`}
      >
        <div className="h-full w-full overflow-hidden">{left}</div>
        {hasRight && (
          <div
            ref={rightRef}
            className="h-full w-full overflow-hidden t-pane-slide-in"
            data-open={paneOpen}
          >
            {right}
          </div>
        )}
      </div>
    </div>
  );
}
