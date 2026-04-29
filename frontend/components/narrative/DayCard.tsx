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
import { useDayPlan } from "../../hooks/useDayPlan";
import { useStreak } from "../../hooks/useStreak";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { FadingRuler } from "../shared/FadingRuler";
import { StreakBadge } from "../streak/StreakBadge";
import type { DayPlanWindow, DriftKind } from "../../types/day-plan";

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
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
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
  if (pct == null) return "—";
  return `± ${pct.toFixed(2)}%`;
}

export function DayCard({
  id = "day-card-anchor",
  className,
  bare,
}: DayCardProps) {
  const { data, isLoading } = useDayPlan();
  const { data: streak } = useStreak();
  const { data: drift } = useDriftStatus();

  const plan = data;
  const window = plan?.windows?.[0] ?? null;
  const hasWindow = !!window;

  const driftVisual: DriftKind | "in-window" = drift?.kind ?? "in-window";

  const baseSurface = bare ? "" : "bg-[var(--fintheon-surface)] rounded-lg p-3";

  return (
    <section
      id={id}
      className={[baseSurface, className].filter(Boolean).join(" ").trim()}
      aria-label="Day card"
      data-tour-target="day-card"
    >
      <header className="flex items-baseline gap-2 mb-1">
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
          ? "Loading…"
          : plan?.deskTheme || "No plan published for today."}
      </p>

      <FadingRuler />

      <dl className="font-mono text-[12px] py-3 space-y-1.5">
        <Row label="Event" value={plan?.eventName ?? "—"} loading={isLoading} />
        <Row
          label="Trading Window"
          value={hasWindow ? fmtTradingWindow(window!) : "—"}
          loading={isLoading}
        />
        <Row
          label="Prices of Interest"
          value={
            hasWindow && window!.pricesOfInterest.length > 0
              ? fmtPrices(window!.pricesOfInterest)
              : "—"
          }
          loading={isLoading}
          doto
          tone="neutral"
        />
        <Row
          label="Invalidation Point"
          value={hasWindow ? fmtPrice(window!.invalidation) : "—"}
          loading={isLoading}
          doto
          tone="bearish"
        />
        <Row
          label="Profit Target"
          value={hasWindow ? fmtPrice(window!.profitTarget) : "—"}
          loading={isLoading}
          doto
          tone="bullish"
        />
        <Row
          label="Expected Move"
          value={hasWindow ? fmtExpectedMove(window!.expectedMovePct) : "—"}
          loading={isLoading}
          doto
        />
      </dl>

      <FadingRuler />

      <footer className="flex items-center justify-between pt-3">
        <StreakBadge current={streak?.streakAtClose ?? 0} fontSize={16} />
        {drift && (
          <span
            className="inline-flex items-center gap-1.5"
            title={drift.message ?? undefined}
            aria-label={`Drift ${DRIFT_LABELS[driftVisual]}${drift.message ? ` — ${drift.message}` : ""}`}
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
      </footer>
    </section>
  );
}

type RowTone = "neutral" | "bullish" | "bearish";

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
