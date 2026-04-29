// [claude-code 2026-04-29] S49: MobileDeskPlan — compact desk plan card for the
//   mobile PWA dash. Fetches /api/day-plan/today, shows actionable plan text
//   + compact price block with bearish/bullish color semantics.
import { useEffect, useState, useCallback } from "react";
import type {
  DayPlan,
  DayPlanWindow,
} from "../../types/day-plan";

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
        fontFamily:
          "'Doto', 'Readable Digits', var(--font-data, monospace)",
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

export function MobileDeskPlan() {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);

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

  const themeText = plan?.deskTheme ?? null;
  const eventName = plan?.eventName ?? null;
  const dayWindow = plan?.windows?.[0] ?? null;
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
      <Label>DESK PLAN</Label>

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

          <Row
            label="Event"
            value={eventName ?? "\u2014"}
          />
          <Row
            label={fmtTradingWindow(dayWindow)}
            value=""
          />

          <Row
            label="Entry"
            value={
              dayWindow.pricesOfInterest.length > 0
                ? fmtPrices(dayWindow.pricesOfInterest)
                : "\u2014"
            }
            doto
          />

          <Row
            label="Invalid"
            value={fmtPrice(dayWindow.invalidation)}
            tone="bearish"
            doto
          />

          <Row
            label="Target"
            value={fmtPrice(dayWindow.profitTarget)}
            tone="bullish"
            doto
          />
        </div>
      )}
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
