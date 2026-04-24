// [claude-code 2026-04-24] S35-T11: Inject Arbitrum "Chamber Read" (17:00 session digest) into PMDB prompt. Dynamic import of getLatestChamberRead so build stays green before T1/T12 lands the arbitrum barrel.
// [claude-code 2026-04-19] S24-T1: MDB no longer writes regime directly — it proposes. Live behind SCORING_V4 env flag so V3 is a one-toggle rollback. Root cause: 2026-04-17 TP manually set BULL_TREND; MDB silently overwrote it 10h later via setRegime(). Kills the silent-override footgun.
// [claude-code 2026-04-05] Strands Phase 8: Replace generateText + OpenRouter fallback with invokeAgent
// [claude-code 2026-03-26] S2-T2: Add regime classification to MDB prompt + auto-parse after generation
import { invokeAgent } from "./strands/index.js";
import {
  writeBrief,
  readLatestBrief,
  readEconEvents,
  type BriefType,
  type BriefRecord,
} from "./supabase-service.js";
import { getFeed } from "./riskflow/feed-service.js";
import { createLogger } from "../lib/logger.js";
import { MARKET_REGIMES, type MarketRegime } from "../types/regime.js";
import { setRegime } from "./regime/regime-service.js";
import { proposeRegimeChange } from "./regime/propose.js";

const SCORING_V4 = process.env.SCORING_V4 === "true";

const log = createLogger("BriefGenerator");

/* ------------------------------------------------------------------ */
/*  Brief type rotation (time-of-day / day-of-week)                    */
/* ------------------------------------------------------------------ */

export const BRIEF_LABELS: Record<string, string> = {
  MDB: "Morning Daily Brief (MDB)",
  ADB: "Afternoon Daily Brief (ADB)",
  PMDB: "Post-Market Daily Brief (PMDB)",
  TWT: "The Weekly Tribune",
};

/**
 * Fetch the latest Arbitrum session-trigger digest for PMDB injection.
 * The import path is assembled at runtime so tsc doesn't statically resolve
 * it — that keeps the build green before T1 lands `services/arbitrum/`.
 * T12 unification swaps this for a direct import once the barrel exists.
 */
async function fetchChamberRead(): Promise<string | null> {
  try {
    const modulePath = "./arbitrum/index.js";
    const mod = (await import(modulePath)) as {
      getLatestChamberRead?: () => Promise<string | null>;
    };
    if (typeof mod.getLatestChamberRead !== "function") return null;
    const text = await mod.getLatestChamberRead();
    return typeof text === "string" && text.trim().length > 0 ? text : null;
  } catch (err) {
    log.warn("Chamber Read unavailable (arbitrum module not loaded)", {
      error: String(err),
    });
    return null;
  }
}

export function getCurrentBriefType(): BriefType {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const timeVal = h * 60 + now.getMinutes();
  // TWT: Sunday >= 17:00 through Monday < 07:00
  if (day === 0 && timeVal >= 17 * 60) return "TWT";
  if (day === 1 && h < 7) return "TWT";
  // PMDB stays active overnight until MDB fires at 6:30 AM
  if (timeVal < 6 * 60 + 30) return "PMDB";
  if (timeVal >= 17 * 60 + 30) return "PMDB";
  if (timeVal >= 11 * 60) return "ADB";
  return "MDB";
}

/* ------------------------------------------------------------------ */
/*  Generate a brief and store in Supabase                             */
/* ------------------------------------------------------------------ */

export interface GenerateBriefResult {
  content: string;
  briefType: BriefType;
  generatedAt: string;
  supabaseId: string | null;
  provider: string;
}

/**
 * Generate a brief of the given type (or auto-detect from time of day),
 * store in Supabase, and return the result.
 */
export async function generateBrief(
  overrideType?: BriefType,
): Promise<GenerateBriefResult> {
  const briefType = overrideType ?? getCurrentBriefType();
  const today = new Date().toISOString().slice(0, 10);

  const [feedResponse, econEvents] = await Promise.allSettled([
    getFeed("system", { limit: 20 }),
    readEconEvents({ from: today, to: today }),
  ]);

  const feedItems =
    feedResponse.status === "fulfilled"
      ? feedResponse.value.items.slice(0, 15)
      : [];
  const events = econEvents.status === "fulfilled" ? econEvents.value : [];

  const feedSummary =
    feedItems.length > 0
      ? feedItems
          .map(
            (item: any, i: number) =>
              `${i + 1}. [${item.macroLevel >= 3 ? "HIGH" : "MED"}] ${item.headline}`,
          )
          .join("\n")
      : "No significant feed items at this time.";

  const econSummary =
    events.length > 0
      ? events
          .map(
            (e) =>
              `• ${e.name}${e.time ? ` at ${e.time}` : ""}${e.actual != null ? ` — Actual: ${e.actual}` : ""}${e.forecast != null ? `, Forecast: ${e.forecast}` : ""}`,
          )
          .join("\n")
      : "No major economic events today.";

  // PMDB runs at 17:15 ET — five minutes after the 17:00 Arbitrum session
  // digest lands. If the session fired, lead PMDB with its consensus + dissent.
  const chamberRead = briefType === "PMDB" ? await fetchChamberRead() : null;
  const chamberSection = chamberRead
    ? `\n## Chamber Read (17:00 Arbitrum Session)\n${chamberRead}\n`
    : "";

  const isFull = briefType === "MDB" || briefType === "TWT";

  const prompt = isFull
    ? `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a comprehensive ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${
  briefType === "MDB"
    ? `Write a full Morning Daily Brief in this exact format:

**Day Type:** [Macro/Catalyst/Drift/Compounding] — one-line reason
**Scheduled Events (ET):** List today's econ events from the calendar above with times. Do NOT fabricate actual/expected numbers — only list what's in the data provided.
**Macro/Political Take:** 2-3 sentences on the macro picture based on the RiskFlow headlines above — labor, inflation, geopolitical, Fed
**Market Risks & VIX:** Event risk from headlines, VIX direction based on catalyst severity
**Overall Sentiment:** One punchy sentence synthesizing the headlines
**Market Regime:** [BULL_TREND | BEAR_TREND | CONSOLIDATION | GEO_TENSIONS | MACRO_ECON | RISK_OFF | EARNINGS_SEASON | ILLIQUID_STUPIDITY]
One-line justification for regime classification.
**Best Intraday Approach:** Specific strategy recommendation (Ripper, AWV, Snipe, etc.)

CRITICAL: Only reference data from the headlines and events provided above. Do NOT fabricate price levels, percentage moves, stock tickers, or actual/forecast numbers that aren't in the input. If you don't have specific data, say so — never hallucinate.

Be direct, use financial shorthand. Anchor ONLY to key macro events. 300-500 words.`
    : `Write the Weekly Tribune for Priced In Capital. This is a two-part report: Past Week Recap + What We Got Ahead.

# PART 1: Past Week Recap

**Market Overview:** Summarize the week's dominant themes based on the RiskFlow headlines above — geopolitical tensions, macro shifts, risk-on/risk-off tone. Be specific about what drove sentiment.

**Macro Data Highlights:** Summarize the key releases referenced in the headlines above. Only cite actual/forecast numbers if they appear in the provided data — never fabricate.

**Political Commentary (Focus: Persons of Interest):** Cover Trump, Lutnick (Commerce), Bessent (Treasury), and any other officials mentioned in the headlines. Specific policy actions, tensions, and market implications.

**VolScore for Past Events (1-10 Scale):** Rate the past week's major events from the headlines: 1=Low Impact, 10=Market-Moving Volatility Spike.

**Sentiment:** Summarize the week's overall sentiment — cautious, bearish, bullish. Base this on headline tone and catalyst severity.

# PART 2: What We Got Ahead (Upcoming Week)

**Scheduled Events:** List upcoming events from the economic calendar above with:
- Day and time
- Event name
- VolScore (1-10)

**Sentiment Outlook:** What will drive next week based on the catalysts and events in the data.

## Rules
- CRITICAL: Only reference data from the headlines and events provided. Do NOT fabricate price levels, percentage moves, stock tickers, daily % changes, or actual/forecast numbers not in the input.
- Be analytical, direct, use financial shorthand
- Anchor to real headlines — no generic filler
- Use the VolScore framework consistently (1-10)
- Political commentary should be specific (names, policy actions) not vague
- 600-900 words total
- Write in Priced In Capital's voice: sharp, convicted, data-driven`
}`
    : `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a brief ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}
${chamberSection}
## Instructions
${
  briefType === "ADB"
    ? "Write 3-5 bullet points covering ONLY new headlines and data since the morning that moved or could move the market. Skip anything already covered in the MDB. Be direct and actionable. Max 200 words."
    : chamberRead
      ? "Write 4-6 bullet points covering new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Lead with a 1-sentence restatement of the Chamber Read consensus above, flag any dissent, then the bullets. Be direct and actionable. Max 250 words."
      : "Write 3-5 bullet points covering ONLY new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Be direct and actionable. Max 200 words."
}`;

  let text: string;
  const usedProvider = "strands-vproxy";

  log.info("Generating brief via Strands agent...");
  const result = await invokeAgent({
    systemPrompt:
      "You are Fintheon, a macro trading assistant for Priced In Capital.",
    userPrompt: prompt,
    model: { temperature: 0.4, maxTokens: isFull ? 4096 : 1024 },
  });
  text = result.text;
  log.info(`Strands agent generated ${text.length} chars`);

  // Auto-detect regime from MDB output (MDB only — parse after generation)
  // [S24-T1] V4: MDB PROPOSES; TP approves. Never writes market_regimes directly.
  //          V3 fallback (direct setRegime) kept behind SCORING_V4 flag so rollback is one env toggle.
  if (briefType === "MDB") {
    try {
      const regimeMatch = text.match(/\*\*Market Regime:\*\*\s*(\w+)/);
      if (regimeMatch) {
        const detected = regimeMatch[1] as MarketRegime;
        if (MARKET_REGIMES.includes(detected)) {
          if (SCORING_V4) {
            // Extract the regime-justification line (first line after the regime token).
            const justifyMatch = text.match(
              /\*\*Market Regime:\*\*\s*\w+\s*\n+([^\n*]+)/,
            );
            const mdbExcerpt = justifyMatch
              ? justifyMatch[1].trim().slice(0, 400)
              : `Auto-detected from MDB: ${detected}`;
            const result = await proposeRegimeChange({
              proposedBy: "mdb_agent",
              proposedRegime: detected,
              reason: mdbExcerpt,
              evidence: {
                mdbExcerpt,
                briefType,
                generatedAt: new Date().toISOString(),
              },
              severity: "high",
            });
            log.info("Regime proposed from MDB (V4)", {
              detected,
              proposalId: result.id,
              status: result.status,
              lockedUntil: result.lockedUntil,
            });
          } else {
            await setRegime(
              detected,
              "mdb_agent",
              0.8,
              "Auto-detected from MDB",
            );
            log.info(`Regime auto-set from MDB (V3): ${detected}`);
          }
        }
      }
    } catch (err) {
      log.warn("Regime auto-detection from MDB failed (non-fatal)", {
        error: String(err),
      });
    }
  }

  // Store in Supabase
  const stored = await writeBrief({
    brief_type: briefType,
    content: text,
    generated_by: "hermes",
    category: briefType,
  });

  log.info(`Brief generated: ${briefType}`, {
    supabaseId: stored?.id,
    provider: usedProvider,
    length: text.length,
  });

  // [claude-code 2026-04-18] A1: Daily Brief push trigger. Idempotent via fingerprint (one push per type per day).
  void (async () => {
    try {
      const { emitPushAndLog } = await import("./notifications/emit.js");
      const today = new Date().toISOString().slice(0, 10);
      const first = text.split(/\n+/).find((l) => l.trim().length > 0) ?? "";
      await emitPushAndLog({
        userId: "all",
        category: "dailyBrief",
        severity: "low",
        title: `${briefType} brief ready`,
        body: first || "New brief available",
        url: stored?.id
          ? `/consilium/briefs/${stored.id}`
          : `/consilium/briefs/latest?type=${encodeURIComponent(briefType)}`,
        fingerprint: `brief:${briefType}:${today}`,
        eventId: stored?.id ?? undefined,
        dedupWindowMins: 60 * 20, // 20h — covers same-day repeats
      });
    } catch (err) {
      log.warn("Brief push emit failed (non-fatal)", { error: String(err) });
    }
  })();

  return {
    content: text,
    briefType,
    generatedAt: new Date().toISOString(),
    supabaseId: stored?.id ?? null,
    provider: usedProvider,
  };
}

/**
 * Check if a brief of the given type was already generated today.
 */
export async function wasBriefGeneratedToday(
  type: BriefType,
): Promise<boolean> {
  const latest = await readLatestBrief(type);
  if (!latest?.created_at) return false;
  const today = new Date().toISOString().slice(0, 10);
  return latest.created_at.startsWith(today);
}
