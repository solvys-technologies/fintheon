// [claude-code 2026-04-26] S45-T2: DayCard — Sanctum surface under Volatility Read.
//   Lays out Desk Theme + data table + streak/drift footer. NO border on the
//   container; FadingRuler primitives carry the visual character. Titles
//   left-justified, values right-justified (Doto), monospace gutter via
//   font-mono. Two prices max, one target.
import { useDayPlan } from "../../hooks/useDayPlan";
import { useStreak } from "../../hooks/useStreak";
import { useDriftStatus } from "../../hooks/useDriftStatus";
import { FadingRuler } from "../shared/FadingRuler";
import { StreakBadge } from "../streak/StreakBadge";
import type { DriftState } from "../../types/day-plan";

const DRIFT_LABELS: Record<DriftState, string> = {
  "in-window": "in-window",
  "drift-alert": "drift alert",
  "tilt-stop": "tilt stop",
  "dead-volume": "dead volume",
};

const DRIFT_COLORS: Record<DriftState, string> = {
  "in-window": "rgba(240, 234, 214, 0.45)",
  "drift-alert": "rgba(199, 159, 74, 0.95)",
  "tilt-stop": "rgba(220, 80, 80, 0.95)",
  "dead-volume": "rgba(199, 159, 74, 0.95)",
};

interface DayCardProps {
  /** Anchor id used by the Strategium daycard tab to scrollIntoView. */
  id?: string;
  className?: string;
}

function fmtPrice(v: number): string {
  return v.toFixed(2);
}

function fmtPrices(values: number[]): string {
  return values.slice(0, 2).map(fmtPrice).join(", ");
}

export function DayCard({ id = "day-card-anchor", className }: DayCardProps) {
  const { data, isLoading } = useDayPlan();
  const { data: streak } = useStreak();
  const { data: drift } = useDriftStatus();

  const window = data?.windows?.[0] ?? null;
  const hasWindow = !!window;

  return (
    <section
      id={id}
      className={
        className
          ? `bg-[var(--fintheon-surface)] rounded-lg p-3 ${className}`
          : "bg-[var(--fintheon-surface)] rounded-lg p-3"
      }
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
          Desk Theme
        </span>
        {data?.brief_source && (
          <span
            className="text-[8px] uppercase tracking-widest"
            style={{ color: "var(--fintheon-muted, #908774)" }}
          >
            {data.brief_source}
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
          : data?.desk_theme || "No plan published for today."}
      </p>

      <FadingRuler />

      <dl className="font-mono text-[12px] py-3 space-y-1.5">
        <Row
          label="Event"
          value={hasWindow ? (window!.event ?? "—") : "—"}
          loading={isLoading}
        />
        <Row
          label="Trading Window"
          value={hasWindow ? window!.trading_window : "—"}
          loading={isLoading}
        />
        <Row
          label="Prices of Interest"
          value={
            hasWindow && window!.prices_of_interest.length > 0
              ? fmtPrices(window!.prices_of_interest)
              : "—"
          }
          loading={isLoading}
          doto
        />
        <Row
          label="Invalidation Point"
          value={hasWindow ? fmtPrice(window!.invalidation_point) : "—"}
          loading={isLoading}
          doto
        />
        <Row
          label="Profit Target"
          value={hasWindow ? fmtPrice(window!.profit_target) : "—"}
          loading={isLoading}
          doto
        />
        <Row
          label="Expected Move"
          value={hasWindow ? window!.expected_move : "—"}
          loading={isLoading}
          doto
        />
      </dl>

      <FadingRuler />

      <footer className="flex items-center justify-between pt-3">
        <StreakBadge
          current={streak?.current ?? 0}
          lastMilestone={streak?.last_milestone ?? null}
          fontSize={16}
        />
        {drift && (
          <span
            className="inline-flex items-center gap-1.5"
            title={drift.message}
            aria-label={`Drift ${DRIFT_LABELS[drift.state]} — ${drift.message}`}
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
                background: DRIFT_COLORS[drift.state],
                display: "inline-block",
              }}
            />
            <span
              className="text-[10px]"
              style={{ color: "var(--fintheon-text)" }}
            >
              {DRIFT_LABELS[drift.state]}
            </span>
          </span>
        )}
      </footer>
    </section>
  );
}

function Row({
  label,
  value,
  loading,
  doto,
}: {
  label: string;
  value: string;
  loading: boolean;
  doto?: boolean;
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
      <dd
        className="tabular-nums text-right shrink-0"
        style={{
          color: loading
            ? "var(--fintheon-muted, #908774)"
            : "var(--fintheon-text)",
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
