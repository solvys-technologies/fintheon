// [claude-code 2026-05-16] S67: Econ grading service — compares Agentic Desk's
// EconForecast predictions against actual econ print data, produces daily
// right/wrong binary grades for desk plan streak display.
import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";
import type { DailyColor } from "../types/day-plan.js";

const log = createLogger("EconGrading");

export interface GradedDay {
  date: string;
  color: DailyColor;
  analysisCorrect: boolean | null;
  forecastSummary: string;
  actualOutcome: string;
}

export interface GradedStreakResponse {
  streakAtClose: number;
  last30: GradedDay[];
}

function normalizeHeadline(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Compare a single EconForecast against actual econ print data.
 * Returns null if no actual print data exists to grade against.
 */
function gradeForecastAgainstActual(
  forecast: {
    missProbability?: number;
    beatProbability?: number;
    aiPrediction?: string;
  },
  actual: { actualValue?: string; deviation?: number },
): { analysisCorrect: boolean; summary: string; outcome: string } {
  if (actual.actualValue == null && actual.deviation == null) {
    return {
      analysisCorrect: false,
      summary: forecast.aiPrediction ?? "No AI prediction",
      outcome: "No actual print data",
    };
  }

  const beatBias = (forecast.beatProbability ?? 0) - (forecast.missProbability ?? 0);
  const wasBeat = actual.deviation != null && actual.deviation > 0;
  const wasMiss = actual.deviation != null && actual.deviation < 0;
  const wasInLine = actual.deviation === 0;

  let analysisCorrect = false;
  if (beatBias > 0.1 && wasBeat) analysisCorrect = true;
  else if (beatBias < -0.1 && wasMiss) analysisCorrect = true;
  else if (Math.abs(beatBias) <= 0.1 && wasInLine) analysisCorrect = true;

  const summary =
    forecast.aiPrediction ??
    `Beat ${(forecast.beatProbability ?? 0).toFixed(0)}% / Miss ${(forecast.missProbability ?? 0).toFixed(0)}%`;

  return {
    analysisCorrect,
    summary,
    outcome: actual.actualValue ?? `Deviation: ${actual.deviation?.toFixed(1)}`,
  };
}

export async function getGradedStreak(userId: string): Promise<GradedStreakResponse> {
  const sb = getSupabaseClient();
  if (!sb) {
    return { streakAtClose: 0, last30: [] };
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  // Read existing streak data
  const { data: streakRows, error: streakErr } = await sb
    .from("day_plan_streaks")
    .select("date, daily_color, streak_at_close")
    .eq("user_id", userId)
    .gte("date", sinceIso)
    .order("date", { ascending: false });

  if (streakErr) {
    log.warn("streak read failed for grading", { error: streakErr.message });
    return { streakAtClose: 0, last30: [] };
  }

  const streakAtClose = streakRows?.[0]?.streak_at_close ?? 0;

  // For each streak day, try to find econ forecast and actual print
  const gradedDays: GradedDay[] = [];
  for (const row of streakRows ?? []) {
    const date = row.date as string;
    const color = (row.daily_color as DailyColor) ?? "flat";

    // Try to find the day plan for this date
    const { data: dayPlans } = await sb
      .from("day_plans")
      .select("id, date")
      .eq("date", date)
      .limit(1);

    let analysisCorrect: boolean | null = null;
    let forecastSummary = "No forecast data";
    let actualOutcome = "No actual print";

    if (dayPlans?.[0]) {
      // Get windows with econ forecasts
      const { data: windows } = await sb
        .from("day_plan_windows")
        .select("id, event_name, econ_forecast")
        .eq("day_plan_id", dayPlans[0].id);

      if (windows?.length) {
        for (const w of windows) {
          if (!w.event_name) continue;
          const forecast = w.econ_forecast as Record<string, unknown> | null;
          if (!forecast) continue;

          // Try to match with an actual economic event print
          const eventName = w.event_name as string;
          const { data: events } = await sb
            .from("economic_events")
            .select("name, actual, forecast_prev, importance")
            .ilike("name", `%${eventName}%`)
            .gte("date_time", `${date}T00:00:00`)
            .lte("date_time", `${date}T23:59:59`)
            .limit(1);

          if (events?.[0]?.actual != null) {
            const deviation =
              events[0].forecast_prev != null
                ? parseFloat(events[0].actual as string) -
                  parseFloat(events[0].forecast_prev as string)
                : null;

            const grade = gradeForecastAgainstActual(
              {
                missProbability: (forecast.miss as Record<string, unknown>)?.probability as number,
                beatProbability: (forecast.beat as Record<string, unknown>)?.probability as number,
                aiPrediction: forecast.aiPrediction as string,
              },
              {
                actualValue: events[0].actual as string,
                deviation: deviation != null && !isNaN(deviation) ? deviation : undefined,
              },
            );
            analysisCorrect = grade.analysisCorrect;
            forecastSummary = grade.summary;
            actualOutcome = grade.outcome;
            break;
          }
        }
      }
    }

    // If no econ_data was matched but there's a stored analysis_correct on the streak row
    const storedCorrect = (row as Record<string, unknown>).analysis_correct;
    if (analysisCorrect === null && typeof storedCorrect === "boolean") {
      analysisCorrect = storedCorrect;
    }

    gradedDays.push({
      date,
      color,
      analysisCorrect,
      forecastSummary,
      actualOutcome,
    });
  }

  return { streakAtClose, last30: gradedDays };
}
