// [claude-code 2026-05-16] S67: Data hiding → redeliberation swap — instead of hiding data
//   30min before release, show redeliberation status against current riskflow items.
import { useEffect, useState, type ReactNode } from "react";

interface PriceRevealTagProps {
  windowStartTime: string;
  children: ReactNode;
}

type TagState = "redeliberating" | "visible";

export function PriceRevealTag({
  windowStartTime,
  children,
}: PriceRevealTagProps) {
  const [state, setState] = useState<TagState>("redeliberating");

  useEffect(() => {
    function evaluate() {
      const now = Date.now();
      const [h, m] = windowStartTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(h, m, 0, 0);
      const startMs = startDate.getTime();

      const adjustedStart = startMs <= now ? startMs + 86_400_000 : startMs;
      const diffMs = adjustedStart - now;

      if (diffMs <= 0) {
        setState("visible");
      } else {
        setState("redeliberating");
      }
    }

    evaluate();
    const id = window.setInterval(evaluate, 15_000);
    return () => window.clearInterval(id);
  }, [windowStartTime]);

  if (state === "visible") {
    return <>{children}</>;
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: "var(--font-data, monospace)",
        fontSize: 10,
        letterSpacing: "0.06em",
        fontStyle: "italic",
        color: "var(--fintheon-accent, #c79f4a)",
        opacity: 0.7,
      }}
    >
      <span>Redeliberating...</span>
    </span>
  );
}
