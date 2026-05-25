// [claude-code 2026-04-19] v5.22 S1: Confidence fuse uses Nothing shimmer + palette color.
// [claude-code 2026-04-15] S16-T4: Next Session Forecast card — visible on ArbitrumChamber Page 0
import type { IVScoreResponse } from "../../types/market-data";
import { NothingFuse } from "../shared/NothingFuse";

interface NextSessionForecastCardProps {
  data: IVScoreResponse | null;
  isLoading: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-orange-400";
  if (score >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return "bg-red-500";
  if (score >= 6) return "bg-orange-400";
  if (score >= 4) return "bg-yellow-400";
  return "bg-emerald-400";
}

export function NextSessionForecastCard({
  data,
  isLoading,
}: NextSessionForecastCardProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            Next Session Forecast
          </span>
          <span className="text-sm font-bold text-gray-600">--</span>
        </div>
      </div>
    );
  }

  const prediction = data.prediction;
  const systemic = data.systemic;

  if (!prediction) {
    return (
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/20 rounded-lg p-3">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          Next Session Forecast
        </span>
        <p className="text-[10px] text-gray-600 mt-1">No forecast available</p>
      </div>
    );
  }

  const regimeProb = prediction.regimeShiftProbability;
  const regimeColor =
    regimeProb > 0.25
      ? "text-red-400"
      : regimeProb > 0.1
        ? "text-amber-400"
        : "text-gray-400";

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/20 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          Next Session Forecast
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-gray-500">
          {prediction.source === "agentDesk" ? "Agent Desk" : "Heuristic"}
        </span>
      </div>

      {/* Projected score + confidence */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`text-xl font-bold ${getScoreColor(prediction.nextSessionScore)}`}
          style={{
            fontFamily: "Doto, ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {prediction.nextSessionScore.toFixed(1)}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-gray-500">Confidence</span>
            <span className="text-[9px] text-gray-300">
              {(prediction.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <NothingFuse
            value={prediction.confidence}
            score={prediction.confidence * 10}
            thickness={3}
          />
        </div>
      </div>

      {/* Regime shift probability */}
      <div className="flex items-center gap-1.5 mb-2 text-[9px]">
        <span className="text-gray-500">Regime Shift:</span>
        <span className={`font-medium ${regimeColor}`}>
          {(regimeProb * 100).toFixed(0)}%
        </span>
      </div>

      {/* Scenario table */}
      {prediction.scenarios.length > 0 && (
        <div className="border-t border-zinc-800 pt-1.5 mb-2">
          <div className="flex items-center justify-between text-[8px] text-gray-600 mb-1">
            <span>Scenario</span>
            <div className="flex gap-3">
              <span className="w-8 text-right">Prob</span>
              <span className="w-6 text-right">Score</span>
            </div>
          </div>
          {prediction.scenarios.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[9px] py-0.5"
            >
              <span className="text-gray-400 truncate mr-2">{sc.label}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-gray-500 w-8 text-right">
                  {(sc.probability * 100).toFixed(0)}%
                </span>
                <span
                  className={`font-medium w-6 text-right ${getScoreColor(sc.projectedScore)}`}
                >
                  {sc.projectedScore.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Systemic risk overlay */}
      {systemic && systemic.score > 0 && (
        <div className="border-t border-zinc-800 pt-1.5 space-y-1">
          <span className="text-[9px] font-medium text-amber-400">
            Systemic Risk
          </span>
          <div className="flex items-center gap-2 text-[9px]">
            <span className="text-gray-400">
              Score:{" "}
              <span className="text-amber-400 font-medium">
                {systemic.score.toFixed(1)}/10
              </span>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              Chains: {systemic.activeChains}
            </span>
          </div>
          {systemic.topRhyme && systemic.topRhyme.matchScore > 0.5 && (
            <p className="text-[9px] text-purple-300">
              {Math.round(systemic.topRhyme.matchScore * 100)}% match to{" "}
              {systemic.topRhyme.crisisYear} {systemic.topRhyme.crisisName}
            </p>
          )}
          {systemic.creditSignals > 0 && (
            <p className="text-[9px] text-red-400">
              {systemic.creditSignals} credit signals in 48h
            </p>
          )}
        </div>
      )}
    </div>
  );
}
