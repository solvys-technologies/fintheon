// [claude-code 2026-04-19] S25-T4b: Backend econ CAO synthesis. POST /api/econ/synthesize takes {tickers, timeframe?} and returns CAO-generated description + third-order thinking per ticker. Forecast only populated when latest print conclusively beat/missed. Uses invokeAgent (Strands) with a JSON-output prompt; falls back to heuristic derivation if the LLM call fails so the UI never shows a blank card.
// [claude-code 2026-04-24] S34-T3: added GET /api/econ/upcoming?country=X&category=Y — reads from the economic_events table now populated by econ-calendar-populator.
import { Hono } from "hono";
import { invokeAgent } from "../../services/strands/index.js";
import {
  readEconHistory,
  readUpcomingEconEvents,
} from "../../services/supabase-service.js";
import { createLogger } from "../../lib/logger.js";
import { runEconCalendarPopulator } from "../../services/cron/econ-calendar-populator.js";

const log = createLogger("EconSynthesize");

interface PrintRow {
  id?: string;
  date: string | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
  ivScore: number | null;
}

interface EventSynthesis {
  ticker: string;
  description: string;
  thirdOrder: string;
  forecast: {
    direction: "beat" | "miss";
    deviation: number | null;
  } | null;
  confidence: number;
  prints: PrintRow[];
}

const SYSTEM_PROMPT = `You are the CAO (Chief Analytics Officer) at Priced In Capital, synthesizing a macro economic event for Fintheon's Econ Intelligence view.

For each release you receive, produce THREE outputs:

1. DESCRIPTION (2-3 sentences, plain English) — what this data actually says about the economy right now, given the recent prints.
2. THIRD_ORDER (1-2 sentences) — second and third-order implications. Who benefits, who hurts, what re-prices, what catches people offside. Trader lens, not economist lens.
3. FORECAST_DIRECTION (either "beat" or "miss" or null) — only populate when the pattern is conclusive enough to make a directional call on the NEXT print. Otherwise null.

No hedging fluff. No "on the other hand". Be direct.

Return strict JSON: {"description": string, "thirdOrder": string, "forecastDirection": "beat" | "miss" | null}`;

function fmtPrints(prints: PrintRow[]): string {
  if (prints.length === 0) return "(no history)";
  return prints
    .slice(0, 8)
    .map(
      (p) =>
        `${p.date ?? "—"} | actual ${p.actual ?? "—"} vs forecast ${p.forecast ?? "—"} vs prev ${p.previous ?? "—"} → ${p.direction ?? "—"} (${p.surprise != null ? `${p.surprise > 0 ? "+" : ""}${p.surprise.toFixed(2)}%` : "—"}, IV ${p.ivScore ?? "—"})`,
    )
    .join("\n");
}

function extractJson(text: string): {
  description?: string;
  thirdOrder?: string;
  forecastDirection?: "beat" | "miss" | null;
} | null {
  // Strip fences + find first {…} block
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function heuristicFallback(ticker: string, prints: PrintRow[]): EventSynthesis {
  const latest = prints[0];
  const beats = prints.filter((p) => p.direction === "beat").length;
  const misses = prints.filter((p) => p.direction === "miss").length;
  const description =
    prints.length === 0
      ? `${ticker} has no recent prints in the window.`
      : `Latest ${ticker} print ${latest.direction === "beat" ? "beat" : latest.direction === "miss" ? "missed" : "printed inline"}${latest.surprise != null ? ` by ${latest.surprise > 0 ? "+" : ""}${latest.surprise.toFixed(2)}%` : ""}. ${beats} beats vs ${misses} misses across ${prints.length} recent prints.`;
  const thirdOrder =
    beats > misses * 1.5
      ? "Repeated upside surprises tilt the path hawkish — term premium expands, /ZN underperforms."
      : misses > beats * 1.5
        ? "Persistent downside surprises soften guidance — risk-on flows return, vol compresses."
        : "Mixed prints keep vol bid into next release — no single-side conviction warranted.";
  const beatMiss =
    latest?.direction === "beat" || latest?.direction === "miss"
      ? latest.direction
      : null;
  return {
    ticker,
    description,
    thirdOrder,
    forecast: beatMiss
      ? { direction: beatMiss, deviation: latest?.surprise ?? null }
      : null,
    confidence: prints.length >= 5 ? 0.55 : 0.35,
    prints,
  };
}

export function createEconRoutes() {
  const app = new Hono();

  // POST /api/econ/synthesize { tickers: string[], timeframe?: string }
  app.post("/synthesize", async (c) => {
    let body: { tickers?: unknown; timeframe?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const tickers = Array.isArray(body.tickers)
      ? (body.tickers as unknown[])
          .filter((t): t is string => typeof t === "string")
          .slice(0, 4)
      : [];
    const timeframe =
      typeof body.timeframe === "string" ? body.timeframe : "3m";

    if (tickers.length === 0) {
      return c.json({ error: "tickers_required" }, 400);
    }

    const events: EventSynthesis[] = await Promise.all(
      tickers.map(async (ticker) => {
        const { prints: rawPrints } = await readEconHistory(ticker, 12);
        const prints: PrintRow[] = rawPrints.map((p) => {
          const actual =
            p.actual_value != null ? parseFloat(p.actual_value) : null;
          const forecast =
            p.forecast_value != null ? parseFloat(p.forecast_value) : null;
          const previous =
            p.previous_value != null ? parseFloat(p.previous_value) : null;
          let surprise: number | null = null;
          let direction: "beat" | "miss" | "inline" | null = null;
          if (actual != null && forecast != null && forecast !== 0) {
            surprise = ((actual - forecast) / Math.abs(forecast)) * 100;
            direction =
              Math.abs(surprise) < 2
                ? "inline"
                : surprise > 0
                  ? "beat"
                  : "miss";
          }
          return {
            id: p.id,
            date: p.printed_at
              ? new Date(p.printed_at).toISOString().slice(0, 10)
              : null,
            actual,
            forecast,
            previous,
            surprise:
              surprise != null ? Math.round(surprise * 100) / 100 : null,
            direction,
            ivScore: p.iv_score ?? null,
          };
        });

        // Call CAO synthesis
        const userPrompt = `TICKER: ${ticker}
TIMEFRAME: ${timeframe}

Recent prints (newest first):
${fmtPrints(prints)}

Return the JSON schema specified in the system prompt.`;

        try {
          const { text } = await invokeAgent({
            systemPrompt: SYSTEM_PROMPT,
            userPrompt,
            model: { temperature: 0.35, maxTokens: 380 },
          });
          const parsed = extractJson(text);
          if (!parsed || !parsed.description) {
            throw new Error("empty_synthesis");
          }
          const latest = prints[0];
          const directionFromLLM =
            parsed.forecastDirection === "beat" ||
            parsed.forecastDirection === "miss"
              ? parsed.forecastDirection
              : null;
          const latestConclusive =
            latest?.direction === "beat" || latest?.direction === "miss";
          const finalDirection =
            directionFromLLM ?? (latestConclusive ? latest.direction : null);

          return {
            ticker,
            description: parsed.description,
            thirdOrder: parsed.thirdOrder ?? "",
            forecast:
              finalDirection && finalDirection !== "inline"
                ? {
                    direction: finalDirection,
                    deviation: latest?.surprise ?? null,
                  }
                : null,
            confidence: Math.min(1, 0.55 + Math.min(prints.length, 10) * 0.04),
            prints,
          } as EventSynthesis;
        } catch (err) {
          log.warn(`CAO synthesis failed for ${ticker} — heuristic fallback`, {
            error: String(err),
          });
          return heuristicFallback(ticker, prints);
        }
      }),
    );

    return c.json({
      timeframe,
      events,
      generatedAt: new Date().toISOString(),
    });
  });

  // [S34-T3] GET /api/econ/upcoming?country=US&category=Inflation&daysAhead=7
  app.get("/upcoming", async (c) => {
    const country = c.req.query("country")?.toUpperCase();
    const category = c.req.query("category");
    const daysAheadRaw = c.req.query("daysAhead");
    const daysAhead = daysAheadRaw ? parseInt(daysAheadRaw, 10) : 7;
    const rows = await readUpcomingEconEvents({
      country: country || undefined,
      category: category || undefined,
      daysAhead:
        Number.isFinite(daysAhead) && daysAhead > 0 && daysAhead <= 90
          ? daysAhead
          : 7,
    });
    return c.json({ events: rows, count: rows.length });
  });

  // [S34-T3] POST /api/econ/populate — manual trigger (debug / smoke).
  // Gated on x-routine-secret matching ROUTINE_SECRET; no-op if env unset.
  app.post("/populate", async (c) => {
    const secret = process.env.ROUTINE_SECRET;
    if (secret && c.req.header("x-routine-secret") !== secret) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const todayOnlyParam = c.req.query("todayOnly");
    const result = await runEconCalendarPopulator({
      todayOnly: todayOnlyParam === "true",
    });
    return c.json({ ok: true, ...result });
  });

  return app;
}
