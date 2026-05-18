// [claude-code 2026-04-16] S20-T2: Filter fetchRecentHeadlines by Oracle's subjects (macro/monetary-policy/prediction-markets/regime)
// [claude-code 2026-05-18] Oracle scheduler now routes through DeepSeek direct.
// [claude-code 2026-04-10] ArbitrumChamber AI scheduler — Oracle generates forward-looking outlook every 30min
import { invokeAgent } from "../strands/invoke-helper.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ArbitrumChamberScheduler");

const RUN_INTERVAL_MS = 60 * 60 * 1000; // 60 min
const CATCH_UP_DELAY_MS = 20_000; // wait 20s after boot before first run

export interface AIInstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
  range: [number, number];
  conviction: "low" | "moderate" | "elevated";
  drivers: string[];
  scoredItemCount: number;
}

interface AIOutlookCache {
  instruments: AIInstrumentOutlook[];
  generatedAt: string;
  source: "oracle-deepseek";
}

let cachedOutlook: AIOutlookCache | null = null;

export function getAIArbitrumChamberOutlook(): AIOutlookCache | null {
  return cachedOutlook;
}

// Oracle's subject domains — used to filter headlines for ArbitrumChamber outlook
const ORACLE_SUBJECTS = new Set([
  "macro",
  "monetary-policy",
  "prediction-markets",
  "regime",
]);

async function fetchRecentHeadlines(): Promise<string> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return "(no DB connection — use general market knowledge)";

    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("scored_riskflow_items")
      .select("headline, sentiment, iv_score, macro_level, tags")
      .gte("published_at", cutoff)
      .gte("iv_score", 4)
      .order("iv_score", { ascending: false })
      .limit(100);

    if (!data || data.length === 0) return "(no high-impact items in last 12h)";

    // Filter by Oracle's subject tags + keep high-impact cross-domain
    const oracleItems: typeof data = [];
    const crossDomain: typeof data = [];

    for (const item of data) {
      const tags: string[] = item.tags || [];
      const hasOracleSubject = tags.some(
        (t) => t.startsWith("subj:") && ORACLE_SUBJECTS.has(t.slice(5)),
      );
      if (hasOracleSubject) {
        oracleItems.push(item);
      } else if ((item.macro_level ?? 0) >= 3) {
        crossDomain.push(item);
      }
    }

    const filtered = [...oracleItems.slice(0, 30), ...crossDomain.slice(0, 5)];

    if (filtered.length === 0) return "(no high-impact items in last 12h)";

    return filtered
      .map(
        (i) =>
          `[IV ${i.iv_score} ${i.sentiment ?? "neutral"} ML${i.macro_level ?? "?"}] ${i.headline}`,
      )
      .join("\n");
  } catch (err) {
    log.warn("Failed to fetch headlines for ArbitrumChamber", {
      error: String(err),
    });
    return "(headline fetch failed)";
  }
}

async function runArbitrumChamberJob(): Promise<void> {
  log.info("ArbitrumChamber AI run starting (Oracle via DeepSeek)");
  const headlines = await fetchRecentHeadlines();

  const systemPrompt = `You are Oracle, the All-Seer analyst at Priced In Capital. You produce forward-looking instrument outlooks for the ArbitrumChamber dashboard. You analyze scored news items and produce structured JSON. Be precise and direct. Only output valid JSON, no markdown.`;

  const userPrompt = `Based on the following high-impact scored news items from the last 12 hours, generate a forward-looking outlook for the next trading session for each instrument: /NQ (Nasdaq), /ES (S&P 500), /YM (Dow Jones), /CL (Crude Oil), /GC (Gold).

HIGH-IMPACT NEWS (last 12h):
${headlines}

Return ONLY a JSON array with this exact structure for each instrument:
[
  {
    "symbol": "/NQ",
    "name": "Nasdaq",
    "ivScore": <0-10 float>,
    "lean": "<bullish|bearish|neutral>",
    "range": [<low_points_int>, <high_points_int>],
    "conviction": "<low|moderate|elevated>",
    "drivers": ["<2-3 sentence max driver>"],
    "scoredItemCount": <int count of relevant items used>
  }
]

Rules:
- ivScore reflects implied volatility pressure for this instrument (0=calm, 10=extreme)
- range is expected intraday move in index points (negative low, positive high)
- conviction is how clearly the news points one way (low unless strongly directional)
- drivers is 1-3 key catalysts driving your assessment
- Be humble on conviction — default to low unless the signal is clear`;

  try {
    const result = await invokeAgent({
      systemPrompt,
      userPrompt,
      provider: "deepseek-direct",
      model: { temperature: 0.2, maxTokens: 2048 },
    });

    // Strip any markdown fencing if model wraps JSON
    const raw = result.text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();

    // Find JSON array in response
    const arrayStart = raw.indexOf("[");
    const arrayEnd = raw.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) {
      log.warn("ArbitrumChamber: Oracle response had no JSON array", {
        preview: raw.slice(0, 200),
      });
      return;
    }

    const instruments = JSON.parse(
      raw.slice(arrayStart, arrayEnd + 1),
    ) as AIInstrumentOutlook[];
    if (!Array.isArray(instruments) || instruments.length === 0) {
      log.warn("ArbitrumChamber: Oracle returned empty array");
      return;
    }

    cachedOutlook = {
      instruments,
      generatedAt: new Date().toISOString(),
      source: "oracle-deepseek",
    };

    log.info(
      `ArbitrumChamber AI run complete — ${instruments.length} instruments`,
      {
        generatedAt: cachedOutlook.generatedAt,
      },
    );
  } catch (err) {
    log.error("ArbitrumChamber AI run failed", { error: String(err) });
  }
}

export function startArbitrumChamberScheduler(): void {
  // Delayed first run — let other services boot first
  setTimeout(() => {
    runArbitrumChamberJob().catch((err) =>
      log.warn("ArbitrumChamber initial run failed (non-fatal)", {
        error: String(err),
      }),
    );
  }, CATCH_UP_DELAY_MS);

  const timer = setInterval(() => {
    runArbitrumChamberJob().catch((err) =>
      log.warn("ArbitrumChamber scheduled run failed (non-fatal)", {
        error: String(err),
      }),
    );
  }, RUN_INTERVAL_MS);

  timer.unref?.();
  log.info(
    `ArbitrumChamberScheduler started (30min interval, first run in ${CATCH_UP_DELAY_MS / 1000}s)`,
  );
}
