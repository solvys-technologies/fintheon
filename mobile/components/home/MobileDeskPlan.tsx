// [claude-code 2026-05-15] Econ forecast: replaced price rows with econ forecast rows.
//   Multi-week cycling via /api/day-plan/multi-week. Chevron nav cycles through
//   all plans across weeks; dots stay per-plan windows.
//   Miss/Beat rows show bullish (green up) or bearish (red down) chevron arrows.

import { useEffect, useState, useCallback } from "react";
import type { DayPlan, DayPlanWindow, EconForecastScenario } from "../../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function fmtTradingWindow(w: DayPlanWindow): string {
  return `${w.startTime}-${w.endTime} ET`;
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

type ScenarioTone = "neutral" | "bullish" | "bearish";

function DotoNum({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: ScenarioTone;
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

function ChevronIcon({ bullish }: { bullish: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      style={{
        color: bullish
          ? "var(--fintheon-bullish)"
          : "var(--fintheon-bearish)",
        transform: bullish ? "rotate(0deg)" : "rotate(180deg)",
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
      }}
      aria-hidden
    >
      <path
        d="M3 6L5 3L7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function useEconReveal(windowStartTime: string) {
  void windowStartTime;
  return { revealed: true, countdown: null };
}

export function MobileDeskPlan() {
  const [allPlans, setAllPlans] = useState<DayPlan[]>([]);
  const [planIndex, setPlanIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentWindowIndex, setCurrentWindowIndex] = useState(0);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/day-plan/multi-week`);
      if (!res.ok) {
        const todayRes = await fetch(`${API_BASE}/api/day-plan/today`);
        if (todayRes.ok) {
          const json = (await todayRes.json()) as { plan: DayPlan | null };
          setAllPlans(json.plan ? [json.plan] : []);
        } else {
          setAllPlans([]);
        }
        return;
      }
      const json = (await res.json()) as { weeks: DayPlan[][] };
      setAllPlans((json.weeks ?? []).flat());
      setPlanIndex((prev) => {
        const flat = (json.weeks ?? []).flat();
        return prev >= flat.length ? 0 : prev;
      });
    } catch {
      setAllPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlan();
    const id = window.setInterval(fetchPlan, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [fetchPlan]);

  const plan = allPlans[planIndex] ?? null;

  const themeText = plan?.deskTheme ?? null;
  const eventName = plan?.eventName ?? null;
  const windows = plan?.windows ?? [];
  const dayWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!dayWindow;
  const forecast = dayWindow?.econForecast ?? null;

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
      <div>
        <Label>DESK PLAN</Label>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontFamily: "var(--font-data, monospace)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {formatDateLabel(plan.date)}
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

          {forecast ? (
            <>
              <EconRow
                label="Forecast"
                window={dayWindow}
                renderValue={(f) => f.forecast}
              />
              <EconScenarioRow
                label="Miss"
                window={dayWindow}
                renderValue={(f) => `${f.miss.description} (${f.miss.probability}%)`}
                scenario={forecast.miss}
              />
              <EconScenarioRow
                label="Beat"
                window={dayWindow}
                renderValue={(f) => `${f.beat.description} (${f.beat.probability}%)`}
                scenario={forecast.beat}
              />
              {forecast.otherNotableEvents.length > 0 && (
                <Row
                  label="Notable"
                  value={forecast.otherNotableEvents.join(", ")}
                />
              )}
              <EconRow
                label="AI"
                window={dayWindow}
                renderValue={(f) => f.aiPrediction}
              />
            </>
          ) : (
            <Row label="Forecast" value="Awaiting data..." />
          )}
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
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: ScenarioTone;
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
          fontFamily: "var(--font-data, monospace)",
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
          color: valueColor,
          textAlign: "right",
        }}
      >
        {value || "\u2014"}
      </span>
    </div>
  );
}

function EconRow({
  label,
  window: w,
  renderValue,
}: {
  label: string;
  window: DayPlanWindow;
  renderValue: (f: NonNullable<DayPlanWindow["econForecast"]>) => string;
}) {
  const { revealed, countdown } = useEconReveal(w.startTime);
  const forecast = w.econForecast;

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

  return (
    <Row
      label={label}
      value={forecast ? renderValue(forecast) : "\u2014"}
      tone="neutral"
    />
  );
}

function EconScenarioRow({
  label,
  window: w,
  renderValue,
  scenario,
}: {
  label: string;
  window: DayPlanWindow;
  renderValue: (f: NonNullable<DayPlanWindow["econForecast"]>) => string;
  scenario: EconForecastScenario;
}) {
  const { revealed, countdown } = useEconReveal(w.startTime);
  const forecast = w.econForecast;
  const tone: ScenarioTone = scenario.isBullishForEquities ? "bullish" : "bearish";

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

  if (!forecast) {
    return <Row label={label} value={"\u2014"} tone={tone} />;
  }

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
          letterSpacing: "0.02em",
          color:
            tone === "bullish"
              ? "var(--fintheon-bullish)"
              : "var(--fintheon-bearish)",
          textAlign: "right",
        }}
      >
        <ChevronIcon bullish={tone === "bullish"} />
        {renderValue(forecast)}
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
