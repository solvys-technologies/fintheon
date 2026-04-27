// [claude-code 2026-04-27] S46.4/K: Combined Blended IV Score + Next Session
// Forecast card for the Sanctum / Arbitrum surface. Replaces the separate
// BlendedVIXCard + NextSessionForecastCard stack per TP — single card, no
// $/contract footer, forecast (Doto numeral + confidence fuse) takes the
// footer slot. Grey bg-[var(--fintheon-surface)] stripped — card is now a
// transparent block with a thin accent ruler between IV components and the
// forecast section.
import type { IVScoreResponse } from "../../types/market-data";
import { NothingFuse } from "../shared/NothingFuse";

interface BlendedIVForecastCardProps {
  data: IVScoreResponse | null;
  isLoading: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 6) return "text-orange-400";
  if (score >= 4) return "text-yellow-400";
  return "text-emerald-400";
}

function getEnvironmentLabel(score: number): string {
  if (score >= 8) return "Shit Show";
  if (score >= 6) return "Tipping Point";
  if (score >= 4) return "Gathering Storm";
  if (score >= 2) return "Light Winds";
  return "Calm Seas";
}

const RULER_STYLE: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--fintheon-accent) 35%, transparent) 50%, transparent 100%)",
  margin: "10px 0",
};

export function BlendedIVForecastCard({
  data,
  isLoading,
}: BlendedIVForecastCardProps) {
  if (isLoading || !data) {
    return (
      <div className="rounded-lg p-3 bg-transparent">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">
            Blended IV Score
          </span>
          <span className="text-sm font-bold text-gray-600">--</span>
        </div>
      </div>
    );
  }

  const envLabel = getEnvironmentLabel(data.score);
  const scoreColor = getScoreColor(data.score);
  const prediction = data.prediction;
  const systemic = data.systemic;

  const components = [
    {
      label: "VIX",
      value: data.vixComponent,
      weight: "70%",
      detail: `(${data.vix.level.toFixed(1)})`,
    },
    {
      label: "Headlines",
      value: data.headlineComponent,
      weight: "20%",
      detail: `(${data.eventCount} events)`,
    },
    {
      label: "Agent Desk",
      value: data.agentDeskComponent,
      weight: "10%",
      detail: null,
    },
  ];

  const regimeProb = prediction?.regimeShiftProbability ?? 0;
  const regimeColor =
    regimeProb > 0.25
      ? "text-red-400"
      : regimeProb > 0.1
        ? "text-amber-400"
        : "text-gray-400";

  return (
    <div className="rounded-lg p-3 bg-transparent">
      {/* IV Score header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          Blended IV Score
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-base font-bold ${scoreColor}`}
            style={{
              fontFamily: "Doto, ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {data.score.toFixed(1)}
          </span>
          <span className={`text-[9px] font-medium ${scoreColor}`}>
            {envLabel}
          </span>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-1.5 mb-1">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-[52px] shrink-0">
              {c.label}
            </span>
            <div className="flex-1">
              <NothingFuse
                value={Math.min(1, c.value / 10)}
                score={c.value}
                thickness={4}
              />
            </div>
            <span className="text-[9px] text-gray-300 w-6 text-right shrink-0">
              {c.value.toFixed(1)}
            </span>
            <span className="text-[8px] text-gray-600 w-6 text-right shrink-0">
              {c.weight}
            </span>
            {c.detail && (
              <span className="text-[8px] text-gray-600 shrink-0">
                {c.detail}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rationale */}
      {data.rationale.length > 0 && (
        <div className="space-y-0.5 mt-2">
          {data.rationale.slice(0, 2).map((line, i) => (
            <p key={i} className="text-[9px] text-gray-500 leading-tight">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* [claude-code 2026-04-27] S46.4/K: Next Session Forecast replaces the
          ±pts | $/contract footer per TP. Doto display + confidence fuse mirror
          the forecast card's existing visual language. */}
      <div style={RULER_STYLE} aria-hidden="true" />
      {prediction ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              Next Session Forecast
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-900/40 text-gray-500">
              {prediction.source === "agentDesk" ? "Agent Desk" : "Heuristic"}
            </span>
          </div>
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
          <div className="flex items-center gap-1.5 text-[9px]">
            <span className="text-gray-500">Regime Shift:</span>
            <span className={`font-medium ${regimeColor}`}>
              {(regimeProb * 100).toFixed(0)}%
            </span>
          </div>
          {prediction.scenarios.length > 0 && (
            <div className="mt-1.5">
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
                  <span className="text-gray-400 truncate mr-2">
                    {sc.label}
                  </span>
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
          {systemic && systemic.score > 0 && (
            <>
              <div style={RULER_STYLE} aria-hidden="true" />
              <div className="space-y-1">
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
                    {systemic.topRhyme.crisisYear}{" "}
                    {systemic.topRhyme.crisisName}
                  </p>
                )}
                {systemic.creditSignals > 0 && (
                  <p className="text-[9px] text-red-400">
                    {systemic.creditSignals} credit signals in 48h
                  </p>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-[10px] text-gray-600">No forecast available</p>
      )}
    </div>
  );
}
