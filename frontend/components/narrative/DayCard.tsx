// [claude-code 2026-04-29] S49: Added tone prop to Row for bearish/bullish
//   color binding via CSS vars (--fintheon-bearish, --fintheon-bullish).
// [claude-code 2026-04-28] T3: Renamed Desk Theme -> Desk Plan in visible UI.
// [claude-code 2026-04-26] S45-T2: DayCard — Sanctum surface under Volatility Read.
//   Lays out Desk Plan + data table + streak/drift footer. NO border on the
//   container; FadingRuler primitives carry the visual character. Titles
//   left-justified, values right-justified (Doto), monospace gutter via
//   font-mono. Two prices max, one target. Field names mirror T1 backend types
//   (DayPlan: deskTheme/eventName + windows[]; DayPlanWindow: startTime/endTime,
//   pricesOfInterest, invalidation, profitTarget, expectedMovePct).
// [claude-code 2026-05-03] S57: optional header streak + hidden footer streak.
// [claude-code 2026-05-13] T2: multi-window chevron nav, lockout button, price gating
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDayPlan } from "../../hooks/useDayPlan";
import { useStreak } from "../../hooks/useStreak";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { useLockout } from "../../hooks/useLockout";
import { useSettings } from "../../contexts/SettingsContext";
import { FadingRuler } from "../shared/FadingRuler";
import { StreakBadge } from "../streak/StreakBadge";
import { DayPlanChevronNav } from "./DayPlanChevronNav";
import { PriceRevealTag } from "./PriceRevealTag";
import type { DayPlanWindow, DriftKind } from "../../types/day-plan";
import {
  getDayPlanHeading,
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
  /** Anchor id used by the Strategium daycard tab to scrollIntoView. */
  id?: string;
  className?: string;
  /** [claude-code 2026-04-26] When the parent container already supplies the
   * surface (e.g. MainDashboard's brief/plan split), drop the inner bg + p-3
   * so the content stretches to fill flush. */
  bare?: boolean;
  hideStreak?: boolean;
  showStreakInHeader?: boolean;
}

function fmtPrice(v: number | null): string {
  if (v == null) return "\u2014";
  return v.toFixed(2);
}

function fmtPrices(values: number[]): string {
  return values
    .slice(0, 2)
    .map((v) => v.toFixed(2))
    .join(", ");
}

function fmtTradingWindow(w: DayPlanWindow): string {
  return `${w.startTime}-${w.endTime}`;
}

function fmtExpectedMove(pct: number | null): string {
  if (pct == null) return "\u2014";
  return `\u00b1 ${pct.toFixed(2)}%`;
}

export function DayCard({
  id = "day-card-anchor",
  className,
  bare,
  hideStreak,
  showStreakInHeader,
}: DayCardProps) {
  const { data, isLoading } = useDayPlan();
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
  const autoLockKeyRef = useRef<string | null>(null);

  const plan = data;
  const windows = plan?.windows ?? [];
  const currentWindow = windows[currentWindowIndex] ?? null;
  const hasWindow = !!currentWindow;

  // Reset index when windows change
  if (currentWindowIndex >= windows.length && windows.length > 0) {
    setCurrentWindowIndex(0);
  }

  const driftVisual: DriftKind | "in-window" = drift?.kind ?? "in-window";

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
        {showStreakInHeader && !hideStreak && (
          <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={14} />
        )}
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
          label={getDayPlanHeading(plan?.date)}
          value={hasWindow ? fmtTradingWindow(currentWindow!) : "\u2014"}
          loading={isLoading}
          lockoutState={lockoutState}
          lockoutTitle={lockoutButtonTitle}
          onLockToggle={() =>
            lockoutState.locked
              ? lockoutUnlock()
              : lockoutLock(lockoutDefaultDuration)
          }
          nav={
            <DayPlanChevronNav
              currentIndex={currentWindowIndex}
              totalWindows={windows.length}
              onPrev={() => setCurrentWindowIndex((i) => Math.max(0, i - 1))}
              onNext={() =>
                setCurrentWindowIndex((i) =>
                  Math.min(windows.length - 1, i + 1),
                )
              }
            />
          }
        />
        <GatedPriceRow
          label="Prices of Interest"
          window={currentWindow}
          loading={isLoading}
          doto
          tone="neutral"
          renderValue={() =>
            currentWindow!.pricesOfInterest.length > 0
              ? fmtPrices(currentWindow!.pricesOfInterest)
              : "\u2014"
          }
        />
        <GatedPriceRow
          label="Invalidation Point"
          window={currentWindow}
          loading={isLoading}
          doto
          tone="bearish"
          renderValue={() =>
            currentWindow ? fmtPrice(currentWindow.invalidation) : "\u2014"
          }
        />
        <GatedPriceRow
          label="Profit Target"
          window={currentWindow}
          loading={isLoading}
          doto
          tone="bullish"
          renderValue={() =>
            currentWindow ? fmtPrice(currentWindow.profitTarget) : "\u2014"
          }
        />
        <GatedPriceRow
          label="Expected Move"
          window={currentWindow}
          loading={isLoading}
          doto
          renderValue={() =>
            currentWindow
              ? fmtExpectedMove(currentWindow.expectedMovePct)
              : "\u2014"
          }
        />
      </dl>

      <FadingRuler />

      {((!hideStreak && !showStreakInHeader) || drift) && (
        <footer className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-2">
            {!hideStreak && !showStreakInHeader ? (
              <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={16} />
            ) : (
              <span aria-hidden />
            )}
          </div>
          <div className="flex items-center gap-2">
            {drift && (
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
            )}
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
  lockoutState,
  lockoutTitle,
  onLockToggle,
  nav,
}: {
  label: string;
  value: string;
  loading: boolean;
  lockoutState: { locked: boolean };
  lockoutTitle?: string;
  onLockToggle: () => void;
  nav: ReactNode;
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
        {nav}
        <button
          onClick={onLockToggle}
          className="inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase tracking-[0.12em] border transition-colors cursor-pointer"
          style={{
            fontFamily: "var(--font-data, monospace)",
            color: lockoutState.locked
              ? "rgba(199, 159, 74, 0.9)"
              : "var(--fintheon-muted, #908774)",
            borderColor: lockoutState.locked
              ? "rgba(199, 159, 74, 0.3)"
              : "rgba(255, 255, 255, 0.08)",
            background: lockoutState.locked
              ? "rgba(199, 159, 74, 0.1)"
              : "transparent",
          }}
          title={lockoutTitle}
        >
          {lockoutState.locked ? "UNLOCK" : "LOCK"}
        </button>
      </dd>
    </div>
  );
}

type RowTone = "neutral" | "bullish" | "bearish";

function GatedPriceRow({
  label,
  window,
  loading,
  doto,
  tone = "neutral",
  renderValue,
}: {
  label: string;
  window: DayPlanWindow | null;
  loading: boolean;
  doto?: boolean;
  tone?: RowTone;
  renderValue: () => string;
}) {
  if (loading || !window) {
    return (
      <Row label={label} value={"\u2014"} loading doto={doto} tone={tone} />
    );
  }

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
          fontFamily: doto
            ? "'Doto', 'Readable Digits', var(--font-data, monospace)"
            : "var(--font-data, monospace)",
          letterSpacing: doto ? "0.04em" : "0.01em",
          fontWeight: doto ? 600 : 400,
        }}
      >
        <PriceRevealTag windowStartTime={window.startTime}>
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
            {renderValue()}
          </span>
        </PriceRevealTag>
      </dd>
    </div>
  );
}

function Row({
  label,
  value,
  loading,
  doto,
  tone = "neutral",
}: {
  label: string;
  value: string;
  loading: boolean;
  doto?: boolean;
  tone?: RowTone;
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
          fontFamily: doto
            ? "'Doto', 'Readable Digits', var(--font-data, monospace)"
            : "var(--font-data, monospace)",
          letterSpacing: doto ? "0.04em" : "0.01em",
          fontWeight: doto ? 600 : 400,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
