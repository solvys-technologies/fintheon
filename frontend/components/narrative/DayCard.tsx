// [claude-code 2026-05-15] Econ forecast: replaced price rows (Prices of Interest,
//   Invalidation Point, Profit Target, Expected Move) with econ forecast rows
//   (Forecast, Miss, Beat, Notable Events, AI Prediction). Speeches show
//   hawkish/dovish/none instead of numerical values. Chevron arrows indicate
//   bullish (green up) or bearish (red down) for equities per scenario.
//   Prices hidden until 30 min before window — fresh data pulled at that time.

import { useEffect, useMemo, useRef, useState } from "react";
import { useDayPlan } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { useStreak } from "../../hooks/useStreak";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { useLockout } from "../../hooks/useLockout";
import { useSettings } from "../../contexts/SettingsContext";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import { AgenticFeedbackControls } from "../shared/AgenticFeedbackControls";
import { StreakBadge } from "../streak/StreakBadge";
import { DayPlanChevronNav } from "./DayPlanChevronNav";
import { DeskPlanCustomForm } from "./DeskPlanCustomForm";
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
  const range = formatEasternClockRange(w.startTime, w.endTime);
  const country = (w.eventCountry ?? w.econForecast?.eventCountry ?? "")
    .toUpperCase()
    .trim();
  if (country && country !== "US" && isOvernightWindow(w)) {
    return `(${country}) ${range}`;
  }
  return range;
}

function isOvernightWindow(w: Pick<DayPlanWindow, "startTime" | "endTime">): boolean {
  const start = minutesFromClock(w.startTime);
  const end = minutesFromClock(w.endTime);
  if (start == null || end == null) return false;
  return start < 8 * 60 || start >= 18 * 60 || end < start;
}

function minutesFromClock(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function currentEasternMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return hour * 60 + minute;
}

function currentEasternDateIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function defaultWindowIndex(planDate: string | undefined, windows: DayPlanWindow[]): number {
  if (windows.length === 0) return 0;
  if (planDate !== currentEasternDateIso()) return 0;
  const now = currentEasternMinutes();
  const active = windows.findIndex((window) => {
    const start = minutesFromClock(window.startTime);
    const end = minutesFromClock(window.endTime);
    if (start == null || end == null) return false;
    return now >= start && now <= end;
  });
  if (active >= 0) return active;
  const upcoming = windows.findIndex((window) => {
    const start = minutesFromClock(window.startTime);
    return start != null && start >= now;
  });
  return upcoming >= 0 ? upcoming : 0;
}

export function DayCard({
  id = "day-card-anchor",
  className,
  bare,
  hideStreak,
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
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const autoLockKeyRef = useRef<string | null>(null);

  const plan = multiWeekPlan ?? todayData;
  const isLoading = multiWeekLoading && todayLoading;
  const allWindows = useMemo(
    () =>
      [...(plan?.windows ?? [])].sort((a, b) => {
        const aStart = minutesFromClock(a.startTime) ?? Number.MAX_SAFE_INTEGER;
        const bStart = minutesFromClock(b.startTime) ?? Number.MAX_SAFE_INTEGER;
        if (aStart !== bStart) return aStart - bStart;
        const aEnd = minutesFromClock(a.endTime) ?? Number.MAX_SAFE_INTEGER;
        const bEnd = minutesFromClock(b.endTime) ?? Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      }),
    [plan?.windows],
  );
  const countries = useMemo(
    () => [
      ...new Set(
        allWindows
          .map((window) => window.eventCountry ?? window.econForecast?.eventCountry ?? "")
          .filter(Boolean),
      ),
    ],
    [allWindows],
  );
  const windows = useMemo(
    () =>
      countryFilter === "ALL"
        ? allWindows
        : allWindows.filter(
            (window) =>
              (window.eventCountry ?? window.econForecast?.eventCountry ?? "")
                .toUpperCase()
                .trim() === countryFilter,
          ),
    [allWindows, countryFilter],
  );
  const windowSignature = windows
    .map((window) => `${window.id}:${window.startTime}:${window.endTime}`)
    .join("|");
  const currentWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!currentWindow;

  useEffect(() => {
    if (windows.length === 0) {
      setCurrentWindowIndex(0);
      return;
    }
    setCurrentWindowIndex(defaultWindowIndex(plan?.date, windows));
  }, [plan?.date, windowSignature]);

  const driftVisual: DriftKind | "in-window" = drift?.kind ?? "in-window";

  const dayOfWeekLabel = plan?.date ? (() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const [y, m, d] = plan.date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  })() : null;

  const baseSurface = bare
    ? "relative"
    : "relative bg-[var(--fintheon-surface)] rounded-lg p-3";
  const lockoutButtonTitle =
    lockoutState.locked && lockoutState.remaining
      ? `${Math.round(lockoutState.remaining / 60)}m left`
      : undefined;
  const toggleExpandedRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      {!hideStreak && plan?.date && (
        <div className="mb-1 flex items-center justify-end">
          <span
            className="ml-auto text-right text-[11.5px]"
            style={{
              color: "var(--fintheon-muted, #908774)",
              fontFamily: "var(--font-data, monospace)",
            }}
          >
            {dayOfWeekLabel}
          </span>
        </div>
      )}
      <header className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[11.5px] font-semibold uppercase tracking-[0.2em]"
            style={{
              color: "var(--fintheon-accent)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Desk Plan
          </span>
          {plan?.sourceBriefId && (
            <span
              className="text-[9px] uppercase tracking-widest"
              style={{ color: "var(--fintheon-muted, #908774)" }}
            >
              brief
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hideStreak && (
            <>
              <DeskPlanCustomForm
                countries={countries}
                selectedCountry={countryFilter}
                onCountryChange={setCountryFilter}
              />
              <DayPlanChevronNav
                currentIndex={currentPlanIndex}
                totalPlans={totalPlans}
                onPrev={goPrevPlan}
                onNext={goNextPlan}
              />
            </>
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
            className={`desk-plan-lock-btn inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.12em] cursor-pointer transition-colors ${shimmering ? "shimmering" : ""}`}
            style={{
              fontFamily: "var(--font-data, monospace)",
              color: lockoutState.locked
                ? "rgba(199, 159, 74, 0.9)"
                : "var(--fintheon-muted, #908774)",
              border: `1px solid ${lockoutState.locked ? "rgba(199, 159, 74, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
              borderColor: "transparent",
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

      {!hideStreak && (
        <div className="mb-2 flex justify-end">
          <span
            className="relative inline-flex items-center gap-1.5"
            onMouseEnter={() => setShowStreakPopup(true)}
            onMouseLeave={() => setShowStreakPopup(false)}
          >
            <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={14} />
            {totalPlans > 1 ? (
              <button
                type="button"
                onClick={goNextPlan}
                disabled={currentPlanIndex >= totalPlans - 1}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--fintheon-accent)]/65 transition-colors hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-gray-700"
                title="Next scored desk plan"
                aria-label="Next scored desk plan"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            ) : null}
            {showStreakPopup && (
              <div className="fintheon-popover-surface absolute top-full right-0 z-50 mt-2 p-3">
                <div className="flex gap-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3.5 w-3.5 rounded"
                      style={{
                        background: i < 10 ? "#4ade80" : "#ef4444",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </span>
        </div>
      )}

      <p
        className="text-[13.5px] leading-relaxed mb-3"
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

      <dl className="font-mono text-[13.5px] py-3 space-y-1.5">
        <Row
          label="Event"
          value={plan?.eventName ?? "\u2014"}
          loading={isLoading}
        />
        <WindowControlRow
          label="Trading Window"
          value={hasWindow ? fmtTradingWindow(currentWindow!) : "\u2014"}
          loading={isLoading}
          currentIndex={currentWindowIndex}
          totalWindows={windows.length}
          onPrev={() => setCurrentWindowIndex((value) => Math.max(0, value - 1))}
          onNext={() =>
            setCurrentWindowIndex((value) =>
              Math.min(windows.length - 1, value + 1),
            )
          }
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
          renderValue={(f) => `${f.miss.probability}%`}
          scenario={currentWindow?.econForecast?.miss}
          expanded={expandedRows.has("miss")}
          onToggle={() => toggleExpandedRow("miss")}
          detail={(f) => f.miss.description}
        />
        <GatedForecastRow
          label="Beat"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={(f) => `${f.beat.probability}%`}
          scenario={currentWindow?.econForecast?.beat}
          expanded={expandedRows.has("beat")}
          onToggle={() => toggleExpandedRow("beat")}
          detail={(f) => f.beat.description}
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
          label="Thesis"
          planDate={plan?.date}
          window={currentWindow}
          loading={isLoading}
          renderValue={() => "View thesis"}
          expanded={expandedRows.has("thesis")}
          onToggle={() => toggleExpandedRow("thesis")}
          detail={(f) => f.aiPrediction}
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
        className="text-[10.5px] uppercase tracking-[0.16em]"
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
        className="text-[11.5px]"
                  style={{ color: "var(--fintheon-text)" }}
                >
                  {DRIFT_LABELS[driftVisual]}
                </span>
              </span>
          </div>
        </footer>
      )}
      {plan?.date && (
        <AgenticFeedbackControls
          surface="desk-plan"
          itemId={`${plan.date}:${currentWindow?.id ?? currentWindowIndex}`}
        />
      )}
    </section>
  );
}

function WindowControlRow({
  label,
  value,
  loading,
  currentIndex,
  totalWindows,
  onPrev,
  onNext,
}: {
  label: string;
  value: string;
  loading: boolean;
  currentIndex: number;
  totalWindows: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt
        className="text-[12.5px]"
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
        {totalWindows > 1 && (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={currentIndex <= 0}
              className="p-0.5 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
              aria-label="Previous desk plan window"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span
              className="text-[11.5px] tabular-nums"
              style={{ color: "var(--fintheon-muted, #908774)" }}
            >
              {currentIndex + 1}/{totalWindows}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={currentIndex >= totalWindows - 1}
              className="p-0.5 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
              aria-label="Next desk plan window"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </span>
        )}
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
  expanded,
  onToggle,
  detail,
}: {
  label: string;
  planDate?: string | null;
  window: DayPlanWindow | null;
  loading: boolean;
  renderValue: (f: NonNullable<DayPlanWindow["econForecast"]>) => string;
  scenario?: { isBullishForEquities: boolean } | null;
  expanded?: boolean;
  onToggle?: () => void;
  detail?: (f: NonNullable<DayPlanWindow["econForecast"]>) => string;
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

  const hasDetail = Boolean(detail && window.econForecast);
  const rowContent = (
    <div className="flex items-baseline gap-3">
      <dt
        className="flex items-center gap-1 text-[12.5px]"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {hasDetail && (
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
            style={{
              color:
                tone === "bullish"
                  ? "var(--fintheon-bullish)"
                  : tone === "bearish"
                    ? "var(--fintheon-bearish)"
                    : "var(--fintheon-accent)",
            }}
          />
        )}
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
                <span>{renderValue(window.econForecast)}</span>
              </span>
            ) : (
              "\u2014"
            )}
          </span>
        </PriceRevealTag>
      </dd>
    </div>
  );

  if (!hasDetail) return rowContent;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left transition-colors hover:bg-[var(--fintheon-accent)]/[0.035]"
      >
        {rowContent}
      </button>
      {expanded && window.econForecast && (
        <div
          className="ml-4 mt-1 rounded-sm px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            color:
              tone === "bullish"
                ? "var(--fintheon-bullish)"
                : tone === "bearish"
                  ? "var(--fintheon-bearish)"
                  : "var(--fintheon-text)",
            background:
              "color-mix(in srgb, var(--fintheon-accent) 5%, transparent)",
            fontFamily: "var(--font-body)",
          }}
        >
          {detail?.(window.econForecast)}
        </div>
      )}
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
        className="text-[12.5px]"
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
