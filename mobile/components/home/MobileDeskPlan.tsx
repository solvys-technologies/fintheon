// [claude-code 2026-04-29] S49: MobileDeskPlan — compact desk plan card for the
//   mobile PWA dash. Fetches /api/day-plan/today, shows actionable plan text
//   + compact price block with bearish/bullish color semantics.
// [claude-code 2026-05-13] T2: multi-window dot navigation, price hiding, lockout badge
import { useEffect, useState, useCallback } from "react";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function fmtPrice(v: number | null): string {
  if (v == null) return "\u2014";
  return v.toFixed(2);
}

function fmtPrices(values: number[]): string {
  return values.map((v) => v.toFixed(2)).join(", ");
}

function fmtTradingWindow(w: DayPlanWindow): string {
  return `${w.startTime}-${w.endTime} ET`;
}

function DotoNum({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "neutral" | "bullish" | "bearish";
}) {
  const color =
    tone === "bullish"
      ? "var(--fintheon-bullish)"
      : tone === "bearish"
        ? "var(--fintheon-bearish)"
        : "var(--text-primary)";

  return (
    <span
      style={{
        fontFamily: "'Doto', 'Readable Digits', var(--font-data, monospace)",
        fontSize: 13,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
        color,
      }}
    >
      {value}
    </span>
  );
}

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

function DesktopMobileDotNav({
  currentIndex,
  totalWindows,
  onChange,
}: {
  currentIndex: number;
  totalWindows: number;
  onChange: (index: number) => void;
}) {
  if (totalWindows <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 8,
      }}
    >
      {Array.from({ length: totalWindows }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-label={`Window ${i + 1}`}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            border: "none",
            padding: 0,
            cursor: "pointer",
            background:
              i === currentIndex
                ? "var(--accent, #c79f4a)"
                : "rgba(255, 255, 255, 0.12)",
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function usePriceReveal(windowStartTime: string) {
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    function evaluate() {
      const now = Date.now();
      const [h, m] = windowStartTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(h, m, 0, 0);
      const startMs = startDate.getTime();
      const adjustedStart = startMs <= now ? startMs + 86_400_000 : startMs;
      const diffMs = adjustedStart - now;
      const fifteenMin = 15 * 60_000;

      if (diffMs <= 0) {
        setRevealed(true);
        setCountdown(null);
      } else if (diffMs <= fifteenMin) {
        setRevealed(false);
        setCountdown(`Reveals in ${Math.max(1, Math.floor(diffMs / 60_000))}m`);
      } else {
        setRevealed(false);
        setCountdown(null);
      }
    }

    evaluate();
    const id = window.setInterval(evaluate, 10_000);
    return () => window.clearInterval(id);
  }, [windowStartTime]);

  return { revealed, countdown };
}

export function MobileDeskPlan() {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWindowIndex, setCurrentWindowIndex] = useState(0);
  const [lockoutLocked, setLockoutLocked] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/day-plan/today`);
      if (!res.ok) {
        setPlan(null);
        return;
      }
      const json = (await res.json()) as { plan: DayPlan | null };
      setPlan(json.plan ?? null);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlan();
    const id = window.setInterval(fetchPlan, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [fetchPlan]);

  // Poll lockout status
  useEffect(() => {
    async function pollLockout() {
      try {
        const res = await fetch(`${API_BASE}/api/lockout/status`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { locked: boolean };
          setLockoutLocked(!!data.locked);
        }
      } catch {
        // silently retry
      }
    }
    pollLockout();
    const id = window.setInterval(pollLockout, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const themeText = plan?.deskTheme ?? null;
  const eventName = plan?.eventName ?? null;
  const windows = plan?.windows ?? [];
  const dayWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!dayWindow;

  if (loading) {
    return (
      <div style={shellStyle}>
        <Label>[LOADING DESK PLAN...]</Label>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={shellStyle}>
        <Label>DESK PLAN</Label>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 4,
          }}
        >
          No desk plan published yet.
        </span>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Label>DESK PLAN</Label>
        {/* Lockout status badge */}
        <span
          style={{
            fontFamily: "var(--font-data, monospace)",
            fontSize: 9,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: lockoutLocked
              ? "var(--accent, #c79f4a)"
              : "var(--text-secondary)",
            opacity: lockoutLocked ? 1 : 0.5,
          }}
        >
          {lockoutLocked ? "LOCKED" : "OPEN"}
        </span>
      </div>

      {themeText && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            lineHeight: 1.45,
            marginTop: 4,
          }}
        >
          {eventName && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginRight: 4,
              }}
            >
              {eventName} &middot;{" "}
            </span>
          )}
          {themeText}
        </p>
      )}

      {hasWindow && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginTop: 10,
          }}
        >
          <div className="fade-divider" style={{ marginBottom: 2 }} />

          <Row label="Event" value={eventName ?? "\u2014"} />
          <Row label={fmtTradingWindow(dayWindow)} value="" />

          <PriceRow
            label="Entry"
            window={dayWindow}
            field="pricesOfInterest"
            formatter={(w) =>
              w.pricesOfInterest.length > 0
                ? fmtPrices(w.pricesOfInterest)
                : "\u2014"
            }
          />

          <PriceRow
            label="Invalid"
            window={dayWindow}
            field="invalidation"
            tone="bearish"
            formatter={(w) => fmtPrice(w.invalidation)}
          />

          <PriceRow
            label="Target"
            window={dayWindow}
            field="profitTarget"
            tone="bullish"
            formatter={(w) => fmtPrice(w.profitTarget)}
          />
        </div>
      )}

      <DesktopMobileDotNav
        currentIndex={currentWindowIndex}
        totalWindows={windows.length}
        onChange={setCurrentWindowIndex}
      />
    </div>
  );
}

function Row({
  label,
  value,
  doto,
  tone = "neutral",
}: {
  label: string;
  value: string;
  doto?: boolean;
  tone?: "neutral" | "bullish" | "bearish";
}) {
  const valueColor =
    tone === "bullish"
      ? "var(--fintheon-bullish)"
      : tone === "bearish"
        ? "var(--fintheon-bearish)"
        : "var(--text-primary)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: doto
            ? "'Doto', 'Readable Digits', var(--font-data, monospace)"
            : "var(--font-data, monospace)",
          fontSize: 13,
          fontWeight: doto ? 600 : 400,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: doto ? "0.04em" : "0.02em",
          color: valueColor,
          textAlign: "right",
        }}
      >
        {value || "\u2014"}
      </span>
    </div>
  );
}

function PriceRow({
  label,
  window: w,
  field,
  tone = "neutral",
  formatter,
}: {
  label: string;
  window: DayPlanWindow;
  field: keyof DayPlanWindow;
  tone?: "neutral" | "bullish" | "bearish";
  formatter: (w: DayPlanWindow) => string;
}) {
  const { revealed, countdown } = usePriceReveal(w.startTime);

  if (!revealed) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-data, monospace)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {countdown ? (
            <>{countdown}</>
          ) : (
            <>
              <LockIcon />
              HIDDEN
            </>
          )}
        </span>
      </div>
    );
  }

  return <Row label={label} value={formatter(w)} tone={tone} doto />;
}

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  padding: "0 16px",
  paddingBottom: 4,
};

function Label({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--accent)",
      }}
    >
      {children}
    </span>
  );
}
