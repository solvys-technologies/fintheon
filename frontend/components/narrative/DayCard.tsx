// [claude-code 2026-05-15] Econ forecast: replaced price rows (Prices of Interest,
//   Invalidation Point, Profit Target, Expected Move) with econ forecast rows
//   (Forecast, Miss, Beat, Notable Events, AI Prediction). Speeches show
//   hawkish/dovish/none instead of numerical values. Chevron arrows indicate
//   bullish (green up) or bearish (red down) for equities per scenario.
//   Prices hidden until 30 min before window — fresh data pulled at that time.

import { useEffect, useRef, useState } from "react";
import { useDayPlan } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { useStreak } from "../../hooks/useStreak";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { useLockout } from "../../hooks/useLockout";
import { useSettings } from "../../contexts/SettingsContext";
import { FadingRuler } from "../shared/FadingRuler";
import { StreakBadge } from "../streak/StreakBadge";
import { DayPlanChevronNav } from "./DayPlanChevronNav";
import { PriceRevealTag } from "./PriceRevealTag";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import type { DayPlanWindow, DriftKind } from "../../types/day-plan";
import {
  getDeskPlanLockoutDecision,
} from "../../utils/day-plan-lockout";

const DRIFT_LABELS: Record<DriftKind | "in-window", string> = {
  "in-window": "in-window",
  drift_alert: "drift alert",
  tilt_stop: "tilt stop",
  dead_volume: "dead volume",
};

const DRIFT_COLORS: Record<DriftKind | "in-window", string> = {
  "in-window": "rgba(240, 234, 214, 0.45)",
  drift_alert: "rgba(199, 159, 74, 0.95)",
  tilt_stop: "rgba(220, 80, 80, 0.95)",
  dead_volume: "rgba(199, 159, 74, 0.95)",
};

interface DayCardProps {
  id?: string;
  className?: string;
  bare?: boolean;
  hideStreak?: boolean;
  showStreakInHeader?: boolean;
}

function fmtTradingWindow(w: DayPlanWindow): string {
  return formatEasternClockRange(w.startTime, w.endTime);
}

export function DayCard({
  id = "day-card-anchor",
  className,
  bare,
  hideStreak,
  showStreakInHeader,
}: DayCardProps) {
  const { data: todayData, isLoading: todayLoading } = useDayPlan();
  const {
    currentPlan: multiWeekPlan,
    totalPlans,
    currentPlanIndex,
    goNext: goNextPlan,
    goPrev: goPrevPlan,
    isLoading: multiWeekLoading,
  } = useDayPlanMultiWeek();
  const { data: streak } = useStreak();
  const { data: drift } = useDriftStatus();
  const {
    lockoutDefaultDuration,
    lockoutAutoBlockOutsideTradingWindow,
    lockoutAutoReleaseMinutes,
  } = useSettings();
  const {
    state: lockoutState,
    lock: lockoutLock,
    unlock: lockoutUnlock,
    lockUntil: lockoutLockUntil,
  } = useLockout();

  const [currentWindowIndex, setCurrentWindowIndex] = useState(0);
  const [shimmering, setShimmering] = useState(false);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const autoLockKeyRef = useRef<string | null>(null);

  const plan = multiWeekPlan ?? todayData;
  const isLoading = multiWeekLoading && todayLoading;
  const windows = plan?.windows ?? [];
  const currentWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!currentWindow;

  if (currentWindowIndex >= windows.length && windows.length > 0) {
    setCurrentWindowIndex(0);
  }

  const driftVisual: DriftKind | "in-window" = drift?.kind ?? "in-window";

  const dayOfWeekLabel = plan?.date ? (() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const [y, m, d] = plan.date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  })() : null;

  const baseSurface = bare ? "" : "bg-[var(--fintheon-surface)] rounded-lg p-3";
  const lockoutButtonTitle =
    lockoutState.locked && lockoutState.remaining
      ? `${Math.round(lockoutState.remaining / 60)}m left`
      : undefined;

  useEffect(() => {
    if (!lockoutAutoBlockOutsideTradingWindow) {
      autoLockKeyRef.current = null;
      return;
    }
    if (isLoading || lockoutState.locked || !plan?.date || windows.length === 0)
      return;

    const decision = getDeskPlanLockoutDecision({
      planDate: plan.date,
      windows,
      autoReleaseMinutes: lockoutAutoReleaseMinutes,
    });
    if (decision.isAllowed || !decision.lockUntil) {
      autoLockKeyRef.current = null;
      return;
    }

    const key = `${plan.date}:${decision.lockUntil}`;
    if (autoLockKeyRef.current === key) return;
    autoLockKeyRef.current = key;
    lockoutLockUntil(decision.lockUntil).then((ok) => {
      if (!ok) autoLockKeyRef.current = null;
    });
  }, [
    isLoading,
    lockoutAutoBlockOutsideTradingWindow,
    lockoutAutoReleaseMinutes,
    lockoutLockUntil,
    lockoutState.locked,
    plan?.date,
    windows,
  ]);

  return (
    <section
      id={id}
      className={[baseSurface, className].filter(Boolean).join(" ").trim()}
      aria-label="Day card"
      data-tour-target="day-card"
    >
      {!showStreakInHeader && !hideStreak && plan?.date && (
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] ml-[2px]"
            style={{
              color: "var(--fintheon-muted, #908774)",
              fontFamily: "var(--font-data, monospace)",
            }}
          >
            {dayOfWeekLabel}
          </span>
          <span
            className="relative inline-flex items-center gap-1.5"
            onMouseEnter={() => setShowStreakPopup(true)}
            onMouseLeave={() => setShowStreakPopup(false)}
          >
            <DayPlanChevronNav
              currentIndex={currentPlanIndex}
              totalPlans={totalPlans}
              onPrev={goPrevPlan}
              onNext={goNextPlan}
            />
            <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={14} />
            {showStreakPopup && (
              <div className="absolute top-full right-0 mt-2 p-3 bg-[#1a1915] border border-white/8 rounded-lg shadow-lg z-50">
                <div className="flex gap-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-3.5 h-3.5 rounded"
                      style={{
                        background: i < 10 ? '#4ade80' : '#ef4444'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </span>
        </div>
      )}
      <header className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{
              color: "var(--fintheon-accent)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Desk Plan
          </span>
          {plan?.sourceBriefId && (
            <span
              className="text-[8px] uppercase tracking-widest"
              style={{ color: "var(--fintheon-muted, #908774)" }}
            >
              brief
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showStreakInHeader && !hideStreak && (
            <span className="inline-flex items-center gap-1.5">
              <DayPlanChevronNav
                currentIndex={currentPlanIndex}
                totalPlans={totalPlans}
                onPrev={goPrevPlan}
                onNext={goNextPlan}
              />
              <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={14} />
            </span>
          )}
          <button
            onClick={() => {
              const action = lockoutState.locked
                ? lockoutUnlock()
                : lockoutLock(lockoutDefaultDuration);
              setShimmering(true);
              setTimeout(() => setShimmering(false), 600);
              return action;
            }}
            title={lockoutButtonTitle}
            className={`desk-plan-lock-btn inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] uppercase tracking-[0.12em] cursor-pointer transition-colors ${shimmering ? "shimmering" : ""}`}
            style={{
              fontFamily: "var(--font-data, monospace)",
              color: lockoutState.locked
                ? "rgba(199, 159, 74, 0.9)"
                : "var(--fintheon-muted, #908774)",
              border: `1px solid ${lockoutState.locked ? "rgba(199, 159, 74, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
              background: "transparent",
            }}
          >
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
            >
              {lockoutState.locked ? (
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              ) : (
                <>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9 0v4" />
                </>
              )}
              {lockoutState.locked && (
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              )}
            </svg>
            {lockoutState.locked ? "LOCK" : "UNLOCK"}
          </button>
        </div>
      </header>

      <p
        className="text-[12px] leading-relaxed mb-3"
        style={{
          color: "var(--fintheon-text)",
          fontFamily: "var(--font-body)",
          minHeight: "1.4em",
        }}
      >
        {isLoading
          ? "Loading\u2026"
          : plan?.deskTheme || "No plan published for today."}
      </p>

      <FadingRuler />

      <dl className="font-mono text-[12px] py-3 space-y-1.5">
        <Row
          label="Event"
          value={plan?.eventName ?? "\u2014"}
          loading={isLoading}
        />
        <WindowControlRow
          label="Trading Window"
          value={hasWindow ? fmtTradingWindow(currentWindow!) : "\u2014"}
          loading={isLoading}
        />
        <GatedForecastRow
          label="Forecast"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={(f) => f.forecast}
        />
        <GatedForecastRow
          label="Miss"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={(f) => `${f.miss.description} (${f.miss.probability}%)`}
          scenario={currentWindow?.econForecast?.miss}
        />
        <GatedForecastRow
          label="Beat"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={(f) => `${f.beat.description} (${f.beat.probability}%)`}
          scenario={currentWindow?.econForecast?.beat}
        />
        {currentWindow?.econForecast?.otherNotableEvents &&
          currentWindow.econForecast.otherNotableEvents.length > 0 && (
          <Row
            label="Notable"
            value={currentWindow.econForecast.otherNotableEvents.join(", ")}
            loading={false}
          />
        )}
        <GatedForecastRow
          label="AI Prediction"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={(f) => f.aiPrediction}
          textLine
        />
      </dl>

      <FadingRuler />

      {drift && (
        <footer className="flex items-center justify-end pt-3">
          <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5"
                title={drift.message ?? undefined}
                aria-label={`Drift ${DRIFT_LABELS[driftVisual]}${drift.message ? ` \u2014 ${drift.message}` : ""}`}
              >
                <span
                  className="text-[9px] uppercase tracking-[0.16em]"
                  style={{
                    color: "var(--fintheon-muted, #908774)",
                    fontFamily: "var(--font-data, monospace)",
                  }}
                >
                  Drift
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: DRIFT_COLORS[driftVisual],
                    display: "inline-block",
                  }}
                />
                <span
                  className="text-[10px]"
                  style={{ color: "var(--fintheon-text)" }}
                >
                  {DRIFT_LABELS[driftVisual]}
                </span>
              </span>
          </div>
        </footer>
      )}
    </section>
  );
}

function WindowControlRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt
        className="text-[11px]"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </dt>
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: 0,
          borderBottom:
            "1px dotted color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
          transform: "translateY(-3px)",
        }}
      />
      <dd className="flex items-center gap-1.5 text-right shrink-0">
        <span
          className="tabular-nums"
          style={{
            color: loading
              ? "var(--fintheon-muted, #908774)"
              : "var(--fintheon-text)",
            fontFamily: "var(--font-data, monospace)",
            letterSpacing: "0.01em",
          }}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

type ScenarioTone = "neutral" | "bullish" | "bearish";

function GatedForecastRow({
  label,
  planDate,
  window,
  loading,
  renderValue,
  scenario,
  textLine,
}: {
  label: string;
  planDate?: string | null;
  window: DayPlanWindow | null;
  loading: boolean;
  renderValue: (f: NonNullable<DayPlanWindow["econForecast"]>) => string;
  scenario?: { isBullishForEquities: boolean } | null;
  textLine?: boolean;
}) {
  if (loading || !window) {
    return (
      <Row label={label} value={"\u2014"} loading />
    );
  }

  const tone: ScenarioTone = scenario
    ? scenario.isBullishForEquities
      ? "bullish"
      : "bearish"
    : "neutral";

  return (
    <div className="flex items-baseline gap-3">
      <dt
        className="text-[11px]"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </dt>
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: 0,
          borderBottom:
            "1px dotted color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
          transform: "translateY(-3px)",
        }}
      />
      <dd
        className="tabular-nums text-right shrink-0"
        style={{
          fontFamily: "var(--font-data, monospace)",
          letterSpacing: "0.01em",
          maxWidth: textLine ? "280px" : undefined,
        }}
      >
        <PriceRevealTag planDate={planDate} windowStartTime={window.startTime}>
          <span
            style={{
              color:
                tone === "neutral"
                  ? "var(--fintheon-text)"
                  : tone === "bullish"
                    ? "var(--fintheon-bullish)"
                    : "var(--fintheon-bearish)",
            }}
          >
            {window.econForecast ? (
              <span className="inline-flex items-center gap-1">
                {tone !== "neutral" && (
                  <Chevron
                    bullish={tone === "bullish"}
                  />
                )}
                <span className={textLine ? "text-[11px] leading-snug inline-block" : ""}>
                  {renderValue(window.econForecast)}
                </span>
              </span>
            ) : (
              "\u2014"
            )}
          </span>
        </PriceRevealTag>
      </dd>
    </div>
  );
}

function Chevron({ bullish }: { bullish: boolean }) {
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

function Row({
  label,
  value,
  loading,
  tone = "neutral",
}: {
  label: string;
  value: string;
  loading: boolean;
  tone?: ScenarioTone;
}) {
  const valueColor =
    loading || tone === "neutral"
      ? undefined
      : tone === "bullish"
        ? "var(--fintheon-bullish)"
        : "var(--fintheon-bearish)";

  return (
    <div className="flex items-baseline gap-3">
      <dt
        className="text-[11px]"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </dt>
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: 0,
          borderBottom:
            "1px dotted color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
          transform: "translateY(-3px)",
        }}
      />
      <dd
        className="tabular-nums text-right shrink-0"
        style={{
          color:
            valueColor ??
            (loading
              ? "var(--fintheon-muted, #908774)"
              : "var(--fintheon-text)"),
          fontFamily: "var(--font-data, monospace)",
          letterSpacing: "0.01em",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
