// [claude-code 2026-04-27] S46.4/K: Combined Blended IV Score + Next Session
// Forecast card for the Sanctum / Arbitrum surface. Replaces the separate
// BlendedVIXCard + NextSessionForecastCard stack per TP.
// [claude-code 2026-05-01] S56 Track B: restructured layout — forecast on top
//   with confidence fuse, scenarios in single row, IV components below,
//   regime-shift bips line dropped.
// [claude-code 2026-05-03] S57: scenario row now uses shared canonical strip with 0% rows.
import type { IVScoreResponse } from "../../types/market-data";
import { FadingRuler } from "../shared/FadingRuler";
import { NothingFuse } from "../shared/NothingFuse";
import { NextSessionScenariosStrip } from "./NextSessionScenariosStrip";

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

export function BlendedIVForecastCard({
  data,
  isLoading,
}: BlendedIVForecastCardProps) {
  if (isLoading || !data) {
    return (
      <div className="p-3 bg-transparent">
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

  return (
    <div className="p-3 bg-transparent">
      {/* ── FORECAST (top) ── */}
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

          <NextSessionScenariosStrip scenarios={prediction.scenarios} />

          <FadingRuler className="my-2.5" />
        </>
      ) : (
        <>
          <p className="text-[10px] text-gray-600 mb-2">
            No forecast available
          </p>
          <FadingRuler className="my-2.5" />
        </>
      )}

      {/* ── BLENDED IV SCORE (below) ── */}
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
    </div>
  );
}
