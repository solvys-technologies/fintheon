// [claude-code 2026-05-16] S67: Data hiding → redeliberation swap — instead of hiding data
//   30min before release, show redeliberation status against current riskflow items.
import { useEffect, useState, type ReactNode } from "react";

interface PriceRevealTagProps {
  planDate?: string | null;
  windowStartTime: string;
  children: ReactNode;
}

type TagState = "redeliberating" | "visible";

export function PriceRevealTag({
  planDate,
  windowStartTime,
  children,
}: PriceRevealTagProps) {
  const [state, setState] = useState<TagState>("redeliberating");

  useEffect(() => {
    function evaluate() {
      const nowParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      const part = (type: string) =>
        nowParts.find((item) => item.type === type)?.value ?? "0";
      const today = `${part("year")}-${part("month")}-${part("day")}`;
      const activeDate = planDate ?? today;
      const [h, m] = windowStartTime.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) {
        setState("visible");
        return;
      }
      const nowMinutes = Number(part("hour")) * 60 + Number(part("minute"));
      const startMinutes = h * 60 + m;

      if (activeDate < today || (activeDate === today && nowMinutes >= startMinutes)) {
        setState("visible");
      } else {
        setState("redeliberating");
      }
    }

    evaluate();
    const id = window.setInterval(evaluate, 15_000);
    return () => window.clearInterval(id);
  }, [planDate, windowStartTime]);

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
