// [claude-code 2026-05-03] S57: shared canonical next-session scenario strip.
import type { IVScoreResponse } from "../../types/market-data";
import { FadingRuler } from "../shared/FadingRuler";

type Scenario = NonNullable<
  IVScoreResponse["prediction"]
>["scenarios"][number];

interface NextSessionScenariosStripProps {
  scenarios?: Scenario[];
  isLoading?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-orange-400";
  if (score >= 4) return "text-yellow-400";
  return "text-emerald-400";
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
      className={`flex flex-col sm:flex-row sm:items-stretch min-w-0 overflow-hidden ${className ?? ""}`}
      aria-label="Next-session volatility scenarios"
    >
      {scenarios.map((scenario, index) => (
        <div key={scenario.label} className="contents">
          {index > 0 && (
            <>
              <FadingRuler className="my-1 sm:hidden" />
              <FadingRuler
                orientation="vertical"
                className="mx-2 hidden sm:block"
              />
            </>
          )}
          <div className="flex-1 min-w-0 px-1.5 py-1">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/55 truncate">
              {scenario.label}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[10px] tabular-nums text-[var(--fintheon-muted)]/70">
                {(scenario.probability * 100).toFixed(0)}%
              </span>
              <span
                className={`text-[13px] font-bold tabular-nums ${getScoreColor(scenario.projectedScore)}`}
                style={{ fontFamily: "Doto, ui-monospace, monospace" }}
              >
                {scenario.projectedScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
