// [Codex 2026-05-27] S102 PIC forecast band between Trading Window and Thesis.
// [claude-code 2026-05-15] Econ forecast: replaced price rows (Prices of Interest,
//   Invalidation Point, Profit Target, Expected Move) with econ forecast rows
//   (Forecast, Miss, Beat, Notable Events, AI Prediction). Speeches show
//   hawkish/dovish/none instead of numerical values. Chevron arrows indicate
//   bullish (green up) or bearish (red down) for equities per scenario.
//   Prices hidden until 30 min before window — fresh data pulled at that time.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDayPlan } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { useLockout } from "../../hooks/useLockout";
import { useSettings } from "../../contexts/SettingsContext";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import { AgenticFeedbackControls } from "../shared/AgenticFeedbackControls";
import { PriceRevealTag } from "./PriceRevealTag";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import type { DayPlanWindow, DriftKind } from "../../types/day-plan";
import { getDeskPlanLockoutDecision } from "../../utils/day-plan-lockout";

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
  hideHeader?: boolean;
  fillThesis?: boolean;
  hideStreak?: boolean;
  windowControlsPortal?: HTMLElement | null;
  preferredWindowId?: string | null;
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

function isOvernightWindow(
  w: Pick<DayPlanWindow, "startTime" | "endTime">,
): boolean {
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

function defaultWindowIndex(
  planDate: string | undefined,
  windows: DayPlanWindow[],
): number {
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
  hideHeader,
  fillThesis,
  hideStreak,
  windowControlsPortal,
  preferredWindowId = null,
}: DayCardProps) {
  const { data: todayData, isLoading: todayLoading } = useDayPlan();
  const { currentPlan: multiWeekPlan, isLoading: multiWeekLoading } =
    useDayPlanMultiWeek();
  const { data: drift } = useDriftStatus();
  const { lockoutAutoBlockOutsideTradingWindow, lockoutAutoReleaseMinutes } =
    useSettings();
  const { state: lockoutState, lockUntil: lockoutLockUntil } = useLockout();

  const [currentWindowIndex, setCurrentWindowIndex] = useState(0);
  const [cycleDirection, setCycleDirection] = useState<"prev" | "next" | null>(
    null,
  );
  const [cycleAnimationKey, setCycleAnimationKey] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const autoLockKeyRef = useRef<string | null>(null);

  const plan =
    multiWeekPlan &&
    ((multiWeekPlan.windows?.length ?? 0) > 0 ||
      (todayData?.windows?.length ?? 0) === 0)
      ? multiWeekPlan
      : todayData;
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
  const windows = allWindows;
  const windowSignature = windows
    .map((window) => `${window.id}:${window.startTime}:${window.endTime}`)
    .join("|");
  const currentWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!currentWindow;
  const hasExternalWindowControls = Boolean(windowControlsPortal);

  useEffect(() => {
    if (windows.length === 0) {
      setCurrentWindowIndex(0);
      setCycleDirection(null);
      return;
    }
    const preferredIndex = preferredWindowId
      ? windows.findIndex((window) => window.id === preferredWindowId)
      : -1;
    const nextIndex =
      preferredIndex >= 0
        ? preferredIndex
        : defaultWindowIndex(plan?.date, windows);
    setCycleDirection(null);
    setCurrentWindowIndex((current) =>
      current === nextIndex ? current : nextIndex,
    );
  }, [plan?.date, preferredWindowId, windowSignature]);

  const cycleWindow = useCallback(
    (direction: "prev" | "next") => {
      setCurrentWindowIndex((value) => {
        const next =
          direction === "prev"
            ? Math.max(0, value - 1)
            : Math.min(windows.length - 1, value + 1);
        if (next === value) return value;
        setCycleDirection(direction);
        setCycleAnimationKey((key) => key + 1);
        return next;
      });
    },
    [windows.length],
  );

  useEffect(() => {
    if (!fillThesis || !hasWindow) return;
    setExpandedRows((prev) => {
      if (prev.has("thesis")) return prev;
      const next = new Set(prev);
      next.add("thesis");
      return next;
    });
  }, [fillThesis, hasWindow, currentWindow?.id]);

  const driftVisual: DriftKind | "in-window" = drift?.kind ?? "in-window";

  const dateLabel = plan?.date
    ? (() => {
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const [y, m, d] = plan.date.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        return `${months[date.getMonth()]} ${date.getDate()}`;
      })()
    : null;

  const baseSurface = bare
    ? "relative"
    : "relative bg-[var(--fintheon-surface)] rounded-lg p-3";
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

  const windowCycler =
    hasExternalWindowControls && windowControlsPortal && windows.length > 1
      ? createPortal(
          <WindowCycler
            currentIndex={currentWindowIndex}
            totalWindows={windows.length}
            onPrev={() => cycleWindow("prev")}
            onNext={() => cycleWindow("next")}
          />,
          windowControlsPortal,
        )
      : null;

  return (
    <>
      {windowCycler}
      <section
        id={id}
        className={[baseSurface, className].filter(Boolean).join(" ").trim()}
        aria-label="Day card"
        data-tour-target="day-card"
      >
        {!hideHeader && (
          <header className="flex items-center gap-3 mb-1">
            <div className="min-w-0">
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
              {!hideStreak && dateLabel && (
                <span
                  className="mt-0.5 block text-[10.5px]"
                  style={{
                    color: "var(--fintheon-muted, #908774)",
                    fontFamily: "var(--font-data, monospace)",
                  }}
                >
                  {dateLabel}
                </span>
              )}
            </div>
          </header>
        )}

        <div
          key={`${currentWindow?.id ?? "no-window"}:${cycleAnimationKey}`}
          className={[
            fillThesis ? "flex min-h-0 flex-1 flex-col" : "",
            cycleDirection === "next"
              ? "desk-plan-card-drill-next"
              : cycleDirection === "prev"
                ? "desk-plan-card-drill-prev"
                : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {!fillThesis && (
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
          )}

          <FadingRuler />

          <dl
            className={`font-mono text-[13.5px] py-3 space-y-1.5 ${
              fillThesis ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
          >
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
              onPrev={() => cycleWindow("prev")}
              onNext={() => cycleWindow("next")}
              showControls={!hasExternalWindowControls}
            />
            <GatedForecastRow
              label="PIC Forecast"
              planDate={plan?.date}
              window={currentWindow}
              loading={isLoading}
              renderValue={picForecastText}
            />
            <GatedForecastRow
              label="Miss"
              planDate={plan?.date}
              window={currentWindow}
              loading={isLoading}
              renderValue={(f) => scenarioPrintWithProbability(f, "miss")}
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
              renderValue={(f) => scenarioPrintWithProbability(f, "beat")}
              scenario={currentWindow?.econForecast?.beat}
              expanded={expandedRows.has("beat")}
              onToggle={() => toggleExpandedRow("beat")}
              detail={(f) => f.beat.description}
            />
            <GatedForecastRow
              label="Confidence"
              planDate={plan?.date}
              window={currentWindow}
              loading={isLoading}
              renderValue={(f) => `${f.confidenceScore ?? 35}%`}
            />
            <GatedForecastRow
              label="Cycle"
              planDate={plan?.date}
              window={currentWindow}
              loading={isLoading}
              renderValue={(f) =>
                (f.dataCycleStage ?? "View 2nd order").slice(0, 44)
              }
              expanded={expandedRows.has("cycle")}
              onToggle={() => toggleExpandedRow("cycle")}
              detail={buildMacroCycleDetail}
            />
            <GatedForecastRow
              label="Thesis"
              planDate={plan?.date}
              window={currentWindow}
              loading={isLoading}
              renderValue={() => "View thesis"}
              expanded={expandedRows.has("thesis")}
              onToggle={() => toggleExpandedRow("thesis")}
              detail={(f) => buildThesisDetail(f)}
              fillDetail={fillThesis}
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
        </div>
      </section>
    </>
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
  showControls = true,
}: {
  label: string;
  value: string;
  loading: boolean;
  currentIndex: number;
  totalWindows: number;
  onPrev: () => void;
  onNext: () => void;
  showControls?: boolean;
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
      <DottedLeader />
      <dd className="flex items-center gap-1.5 text-right shrink-0">
        {showControls && totalWindows > 1 && (
          <WindowCycler
            currentIndex={currentIndex}
            totalWindows={totalWindows}
            onPrev={onPrev}
            onNext={onNext}
          />
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

function WindowCycler({
  currentIndex,
  totalWindows,
  onPrev,
  onNext,
}: {
  currentIndex: number;
  totalWindows: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex <= 0}
        className="rounded p-0.5 text-[var(--fintheon-accent)]/60 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-gray-700"
        aria-label="Previous desk plan window"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span
        className="font-mono text-[11.5px] tabular-nums"
        style={{ color: "var(--fintheon-muted, #908774)" }}
      >
        {currentIndex + 1}/{totalWindows}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= totalWindows - 1}
        className="rounded p-0.5 text-[var(--fintheon-accent)]/60 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-gray-700"
        aria-label="Next desk plan window"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </span>
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
  fillDetail,
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
  fillDetail?: boolean;
}) {
  if (loading || !window) {
    return <Row label={label} value={"\u2014"} loading />;
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
      <DottedLeader />
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
                {tone !== "neutral" && <Chevron bullish={tone === "bullish"} />}
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
    <div className={fillDetail ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left transition-colors hover:text-[var(--fintheon-accent)]"
      >
        {rowContent}
      </button>
      {expanded && window.econForecast && (
        <div
          className={`ml-4 mt-1 animate-in fade-in duration-300 text-[12.5px] leading-relaxed ${
            fillDetail
              ? "min-h-[112px] flex-1 overflow-y-auto pr-1"
              : "px-3 py-2"
          }`}
          style={{
            color:
              tone === "bullish"
                ? "var(--fintheon-bullish)"
                : tone === "bearish"
                  ? "var(--fintheon-bearish)"
                  : "var(--fintheon-text)",
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
        color: bullish ? "var(--fintheon-bullish)" : "var(--fintheon-bearish)",
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
      <DottedLeader />
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

function DottedLeader() {
  return (
    <span
      aria-hidden
      className="flex-1"
      style={{
        height: 1,
        transform: "translateY(-3px)",
        backgroundImage:
          "repeating-linear-gradient(to right, color-mix(in srgb, var(--fintheon-accent) 16%, transparent) 0 2px, transparent 2px 7px)",
        WebkitMaskImage:
          "linear-gradient(to right, #000 0%, #000 35%, transparent 50%, #000 65%, #000 100%)",
        maskImage:
          "linear-gradient(to right, #000 0%, #000 35%, transparent 50%, #000 65%, #000 100%)",
      }}
    />
  );
}

function scenarioPrint(
  forecast: NonNullable<DayPlanWindow["econForecast"]>,
  side: "miss" | "beat",
) {
  const explicit = forecast[side]?.agenticPrint?.trim();
  if (explicit) return explicit;

  const clean = forecast.calendarConsensus?.trim();
  if (!clean || /^(n\/?a|null|undefined)$/i.test(clean)) return side;

  const lower = clean.toLowerCase();
  if (lower === "hawkish" || lower === "dovish" || lower === "none") {
    if (side === "miss") return lower === "hawkish" ? "dovish" : lower;
    return lower === "dovish" ? "hawkish" : lower;
  }

  if (/^[<>≤≥]/.test(clean)) return clean;
  return `${side === "miss" ? "<" : ">"}${clean}`;
}

function scenarioPrintWithProbability(
  forecast: NonNullable<DayPlanWindow["econForecast"]>,
  side: "miss" | "beat",
) {
  const probability =
    side === "miss"
      ? (forecast.missProbability ?? forecast.miss.probability)
      : (forecast.beatProbability ?? forecast.beat.probability);
  return `${scenarioPrint(forecast, side)} ${probability}%`;
}

function picForecastText(forecast: NonNullable<DayPlanWindow["econForecast"]>) {
  const explicit = forecast.picInternalForecast?.trim();
  if (explicit) return explicit.slice(0, 72);
  const prediction = forecast.aiPrediction?.trim();
  if (prediction) return prediction.slice(0, 72);
  return "Internal read pending";
}

function buildMacroCycleDetail(
  forecast: NonNullable<DayPlanWindow["econForecast"]>,
) {
  return [
    `Fed: ${forecast.fedMilestoneAnchor ?? "pending"}`,
    `2nd: ${forecast.secondOrderRead ?? "pending"}`,
    `X-asset: ${forecast.crossAssetTransmission ?? "pending"}`,
    `Confirms: ${forecast.whatConfirms ?? "pending"}`,
    `Invalidates: ${forecast.whatInvalidates ?? "pending"}`,
  ].join(" | ");
}

function buildThesisDetail(
  forecast: NonNullable<DayPlanWindow["econForecast"]>,
) {
  const base = forecast.aiPrediction?.trim() || "Awaiting agent forecast.";
  if (base.length >= 160) return base;
  const miss = forecast.miss?.description
    ? ` Miss path: ${forecast.miss.description}`
    : "";
  const beat = forecast.beat?.description
    ? ` Beat path: ${forecast.beat.description}`
    : "";
  return `${base}${miss}${beat}`;
}
