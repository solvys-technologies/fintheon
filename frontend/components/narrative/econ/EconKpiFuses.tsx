// [claude-code 2026-04-19] S25-T4a: Econ Intelligence KPI fuses (left column of Econ page header). Vertically stacked, clear headers, Doto numbers. Aggregates the same /api/data/econ-calendar payload Sanctum already pulls.
import { useMemo } from "react";
import type { EconEventCardData } from "./EconEventCard";

interface EconKpiFusesProps {
  /** Catalogue of events with releasesCollected populated; same shape as EconEventFilter consumes */
  catalogue: EconEventCardData[];
  /** Latest IV roll-up averaged from prints — optional */
  inflationPulse?: number;
  laborPulse?: number;
  supplyPulse?: number;
}

export function EconKpiFuses({
  catalogue,
  inflationPulse,
  laborPulse,
  supplyPulse,
}: EconKpiFusesProps) {
  // Coverage = how many events in each category have prints collected
  const coverage = useMemo(() => {
    const c = { "price-stability": 0, employment: 0, "supply-chain": 0 };
    for (const evt of catalogue) {
      if (
        evt.releasesCollected > 0 &&
        c[evt.category as keyof typeof c] != null
      ) {
        c[evt.category as keyof typeof c] += 1;
      }
    }
    return c;
  }, [catalogue]);

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span
          className="text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/85"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Econ Pulse
        </span>
        <span className="text-[8px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/40">
          IV-weighted, 30d
        </span>
      </div>
      <Fuse
        label="Inflation Pulse"
        value={inflationPulse}
        coverage={coverage["price-stability"]}
      />
      <Fuse
        label="Labor Pulse"
        value={laborPulse}
        coverage={coverage["employment"]}
      />
      <Fuse
        label="Supply / Output"
        value={supplyPulse}
        coverage={coverage["supply-chain"]}
      />
    </div>
  );
}

function Fuse({
  label,
  value,
  coverage,
}: {
  label: string;
  value?: number;
  coverage?: number;
}) {
  const pct = value != null ? Math.max(0, Math.min(10, value)) * 10 : 0;
  const color =
    value == null
      ? "var(--fintheon-muted)"
      : value >= 7
        ? "var(--fintheon-severe)"
        : value >= 5
          ? "var(--fintheon-neutral-severe)"
          : value >= 3
            ? "var(--fintheon-accent)"
            : "var(--fintheon-low)";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span
          className="text-[9px] tracking-[0.2em] uppercase text-[var(--fintheon-muted)]/60"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          {coverage != null && (
            <span className="text-[8px] text-[var(--fintheon-muted)]/35">
              {coverage} src
            </span>
          )}
          <span
            className="text-[14px] font-bold"
            style={{
              color,
              fontFamily: "Doto, ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {value != null ? value.toFixed(1) : "—"}
          </span>
        </div>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--fintheon-border)]/12 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
