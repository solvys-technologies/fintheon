// [claude-code 2026-03-28] S8-T4: Volatility amplifier multiplier replaces probability/score bars
import { useState, useEffect } from "react";
import type {
  AgentDeskScenario,
  AgentDeskCategoryScore,
} from "../../types/agent-desk";
import { AskAboutThis } from "../chat/AskAboutThis";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface SanctumThesesProps {
  scenarios: AgentDeskScenario[];
  categoryScores: AgentDeskCategoryScore[];
  expanded?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 7) return "var(--fintheon-severe)";
  if (score >= 5) return "var(--fintheon-neutral-severe)";
  return "var(--fintheon-low)";
}

export function SanctumTheses({
  scenarios,
  categoryScores,
  expanded,
}: SanctumThesesProps) {
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/regime/current`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.multipliers) setMultipliers(data.multipliers);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const compositeAvg =
    categoryScores.length > 0
      ? categoryScores.reduce((s, c) => s + c.ivScore, 0) /
        categoryScores.length
      : 5;

  const sorted = [...scenarios]
    .sort(
      (a, b) =>
        Math.abs(b.projectedScore - compositeAvg) -
        Math.abs(a.projectedScore - compositeAvg),
    )
    .slice(0, expanded ? 10 : 5);

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-[var(--fintheon-muted)]/40 text-center py-8 italic">
        No prediction theses available
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-2">
      <div className="flex justify-end">
        <AskAboutThis
          surface="sanctum_forecast"
          label="these forecasts"
          payload={{
            top_theses: sorted.slice(0, 5).map((t) => ({
              label: t.label,
              projected_score: t.projectedScore,
            })),
            composite_avg: compositeAvg,
          }}
        />
      </div>
      <div
        className={`grid gap-3 ${expanded ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"}`}
      >
      {sorted.map((thesis, idx) => {
        const volatility = Math.abs(thesis.projectedScore - compositeAvg);
        const isTop = idx === 0;
        // Volatility amplifier: how much more volatile vs baseline
        const baseMultiplier =
          compositeAvg > 0 ? thesis.projectedScore / compositeAvg : 1;
        const regimeMultiplier = multipliers[thesis.label] ?? null;
        const amplifier = regimeMultiplier ?? baseMultiplier;

        return (
          <div
            key={thesis.label + idx}
            className={`rounded-lg border p-4 transition-colors ${
              isTop
                ? "border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/5"
                : "border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/40"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  {isTop && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]">
                      TOP
                    </span>
                  )}
                  <span className="text-xs text-[var(--fintheon-text)] font-medium truncate">
                    {thesis.label}
                  </span>
                </div>
                {thesis.description && (
                  <p className="text-[9px] italic text-[var(--fintheon-muted)]/50 mt-1 line-clamp-2">
                    {thesis.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Volatility amplifier multiplier */}
                <span
                  className="text-[10px] font-mono italic text-[var(--fintheon-accent)]/70"
                  title="Volatility amplifier — how much more volatile vs baseline"
                >
                  x{amplifier.toFixed(2)}
                </span>
                {/* Projected score */}
                <span
                  className="text-lg font-mono font-bold"
                  style={{ color: getScoreColor(thesis.projectedScore) }}
                >
                  {thesis.projectedScore.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
