// [claude-code 2026-05-03] S57: shared canonical next-session scenario strip.
import type { IVScoreResponse } from "../../types/market-data";
import { FadingRuler } from "../shared/FadingRuler";
import { NothingFuse } from "../shared/NothingFuse";

type Scenario = NonNullable<IVScoreResponse["prediction"]>["scenarios"][number];

interface NextSessionScenariosStripProps {
  scenarios?: Scenario[];
  isLoading?: boolean;
  className?: string;
}

export function NextSessionScenariosStrip({
  scenarios,
  isLoading,
  className,
}: NextSessionScenariosStripProps) {
  if (isLoading) {
    return (
      <div
        className={`py-3 text-[9px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/35 ${className ?? ""}`}
      >
        Loading scenarios...
      </div>
    );
  }

  if (!scenarios?.length) {
    return (
      <div
        className={`py-3 text-[10px] text-[var(--fintheon-muted)]/40 ${className ?? ""}`}
      >
        No volatility scenarios available.
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 overflow-hidden ${className ?? ""}`}
      aria-label="Next-session volatility scenarios"
    >
      {scenarios.map((scenario, index) => (
        <div key={scenario.label} className="contents">
          {index > 0 && (
            <FadingRuler className="my-0.5" />
          )}
          <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 px-1.5 py-0.5">
            <span className="truncate text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/55">
              {scenario.label}
            </span>
            <NothingFuse
              value={scenario.probability}
              score={scenario.probability * 10}
              thickness={3}
              segments={10}
            />
            <span className="text-right font-mono text-[10px] tabular-nums text-[var(--fintheon-muted)]/75">
              {(scenario.probability * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
