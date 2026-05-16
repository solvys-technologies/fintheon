// [claude-code 2026-05-15] Econ forecast: reveal window changed from 15min to 30min
//   before session — fresh econ data pulled at that time. Hides econ forecasts
//   until 30min before the window starts.
import { useEffect, useState, type ReactNode } from "react";

function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

interface PriceRevealTagProps {
  windowStartTime: string;
  children: ReactNode;
}

type TagState = "hidden" | "countdown" | "visible";

export function PriceRevealTag({
  windowStartTime,
  children,
}: PriceRevealTagProps) {
  const [state, setState] = useState<TagState>("hidden");
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    function evaluate() {
      const now = Date.now();
      const [h, m] = windowStartTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(h, m, 0, 0);
      const startMs = startDate.getTime();

      // If start time already passed today, set it for tomorrow
      const adjustedStart = startMs <= now ? startMs + 86_400_000 : startMs;

      const diffMs = adjustedStart - now;
      const diffMin = Math.floor(diffMs / 60_000);
      const thirtyMin = 30 * 60_000;

      if (diffMs <= 0) {
        setState("visible");
      } else if (diffMs <= thirtyMin) {
        setState("countdown");
        setMinutes(Math.max(1, diffMin));
      } else {
        setState("hidden");
      }
    }

    evaluate();
    const id = window.setInterval(evaluate, 10_000);
    return () => window.clearInterval(id);
  }, [windowStartTime]);

  // Show actual price content when visible
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
        textTransform: "uppercase",
        color: "var(--fintheon-muted, #908774)",
      }}
    >
      {state === "hidden" && (
        <>
          <LockIcon />
          <span>HIDDEN</span>
        </>
      )}
      {state === "countdown" && minutes !== null && (
        <span>Reveals in {minutes}m</span>
      )}
    </span>
  );
}
