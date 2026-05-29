// [Codex 2026-05-27] S102 briefs consume PIC macro event-risk cognition.
// [claude-code 2026-05-03] S58-T3: Route MDB/ADB/PMDB/TWT generation through the DeepSeek primary provider chain.
// [claude-code 2026-04-26] S45-T1: Inline Desk Theme block — pulls today's day_plan + windows and renders a monospace gutter (titles left / values right) before invokeAgent so MDB / ADB / PMDB / TWT all carry the prescriptive Day Card context.
// [claude-code 2026-04-24] S35-T11: Inject Arbitrum "Chamber Read" (17:00 session digest) into PMDB prompt. Dynamic import of getLatestChamberRead so build stays green before T1/T12 lands the arbitrum barrel.
// [claude-code 2026-04-19] S24-T1: MDB no longer writes regime directly — it proposes. Live behind SCORING_V4 env flag so V3 is a one-toggle rollback. Root cause: 2026-04-17 TP manually set BULL_TREND; MDB silently overwrote it 10h later via setRegime(). Kills the silent-override footgun.
// [claude-code 2026-04-05] Strands Phase 8: Replace generateText + OpenRouter fallback with invokeAgent
// [claude-code 2026-03-26] S2-T2: Add regime classification to MDB prompt + auto-parse after generation
import { readDayPlan } from "./day-plan/day-plan-service.js";
import { generateViaChain } from "./ai/provider-chain.js";
import {
  assertUsableBriefContent,
  isUsableBriefContent,
} from "./brief-validation.js";
import type { DayPlan } from "../types/day-plan.js";
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
import { loadMacroEventCognitionBlock } from "./ai/agent-instructions/macro-event-cognition.js";

const SCORING_V4 = process.env.SCORING_V4 === "true";

const log = createLogger("BriefGenerator");

/* ------------------------------------------------------------------ */
/*  Brief type rotation (time-of-day / day-of-week)                    */
/* ------------------------------------------------------------------ */

export const BRIEF_LABELS: Record<string, string> = {
  MDB: "Morning Daily Brief (MDB)",
  ADB: "Afternoon Daily Brief (ADB)",
  PMDB: "Post-Market Daily Brief (PMDB)",
  TWT: "The Weekly Tribune (legacy TOTT)",
};

const CATALYST_CASCADE_TABLE_RULES = `## Catalyst Cascade Table Rule
When the provided headlines or desk context show a series of related catalysts compounding into the same market theme, include a compact Markdown table.

Use the table only when warranted:
- 3+ related catalysts point at the same regime, positioning, or volatility theme; or
- 2 catalysts plus clear market reaction imply potential catalyst drift.

Table format:
| Source | Signal | Implication |
| --- | --- | --- |
| <headline/source> | <what changed> | <desk consequence> |

After the table, add one short "Session Drift Watch" line if the cluster can carry beyond the current session. Do not add a table for isolated one-off headlines.`;

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

/**
 * [S45-T1] Pull today's day_plan and render a pre-formatted Desk Theme block
 * — titles left, values right, monospace gutter — for inline injection into
 * MDB / ADB / PMDB / TWT prompts. Returns null when no plan is persisted.
 */
async function fetchDeskThemeBlock(dateIso: string): Promise<string | null> {
  try {
    const plan = await readDayPlan("pic", dateIso);
    if (!plan) return null;
    return formatDeskThemeBlock(plan);
  } catch (err) {
    log.warn("Desk Theme block fetch failed (non-fatal)", {
      error: String(err),
    });
    return null;
  }
}

function formatDeskThemeBlock(plan: DayPlan): string {
  const lines: string[] = ["## Desk Plan", "```"];
  if (plan.eventName) lines.push(padRow("Event", plan.eventName));
  if (plan.deskTheme) lines.push(padRow("Theme", plan.deskTheme));
  for (const w of plan.windows) {
    lines.push(padRow("Window", `${w.startTime}-${w.endTime} ET`));
    if (w.eventName) {
      lines.push(padRow("Catalyst", w.eventName));
    }
    if (w.econForecast) {
      lines.push(padRow("PIC Forecast", forecastedActualText(w.econForecast)));
      lines.push(
        padRow(
          "Miss",
          `${briefScenarioPrint(w.econForecast, "miss")} (${w.econForecast.missProbability ?? w.econForecast.miss.probability}%)`,
        ),
      );
      lines.push(
        padRow(
          "Beat",
          `${briefScenarioPrint(w.econForecast, "beat")} (${w.econForecast.beatProbability ?? w.econForecast.beat.probability}%)`,
        ),
      );
      lines.push(
        padRow("Confidence", `${w.econForecast.confidenceScore ?? 35}%`),
      );
      lines.push(
        padRow("2nd Order", w.econForecast.secondOrderRead ?? "pending"),
      );
      lines.push(padRow("Thesis", forecastThesisText(w.econForecast)));
    }
  }
  lines.push("```");
  return lines.join("\n");
}

function briefScenarioPrint(
  forecast: NonNullable<DayPlan["windows"][number]["econForecast"]>,
  side: "miss" | "beat",
): string {
  return forecast[side]?.agenticPrint || forecast[side]?.description || side;
}

function forecastedActualText(
  forecast: NonNullable<DayPlan["windows"][number]["econForecast"]>,
): string {
  return (
    extractForecastedActual(forecast.forecast) ??
    extractForecastedActual(forecast.picInternalForecast) ??
    extractForecastedActual(forecast.calendarConsensus) ??
    "pending"
  );
}

function forecastThesisText(
  forecast: NonNullable<DayPlan["windows"][number]["econForecast"]>,
): string {
  const note = forecastTextNote(forecast);
  return (
    [note, forecast.aiPrediction?.trim()]
      .filter((item): item is string => Boolean(item))
      .join(" ")
      .trim() || "pending"
  );
}

function extractForecastedActual(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|null|undefined|pending)$/i.test(trimmed)) {
    return null;
  }
  const tone = trimmed.match(/\b(hawkish|dovish|none)\b/i)?.[1];
  if (tone) return tone.toLowerCase();
  const token = trimmed.match(
    /[<>≤≥]?\s*[-+]?\d+(?:\.\d+)?\s*(?:%|k|m|b|bp|bps|mm|bn)?/i,
  )?.[0];
  return token ? token.replace(/\s+/g, "").slice(0, 18) : null;
}

function forecastTextNote(
  forecast: NonNullable<DayPlan["windows"][number]["econForecast"]>,
): string | null {
  const raw = forecast.picInternalForecast?.trim();
  if (!raw) return null;
  const actual = extractForecastedActual(raw);
  const note = actual
    ? raw
        .replace(actual, "")
        .replace(/^[-–—:,\s]+/, "")
        .trim()
    : raw;
  if (!note || (note === raw && actual)) return null;
  return /[a-z]{3}/i.test(note) ? note : null;
}

function padRow(label: string, value: string): string {
  return `${label.padEnd(16, " ")}${value}`;
}

function toNewYorkWallDate(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
}

function dateInNewYork(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getCurrentBriefType(nowInput = new Date()): BriefType {
  const now = toNewYorkWallDate(nowInput);
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

export function getBriefWindowStart(
  type: BriefType,
  nowInput = new Date(),
): Date {
  const now = toNewYorkWallDate(nowInput);
  const start = new Date(now);
  start.setSeconds(0, 0);

  if (type === "TWT") {
    const day = now.getDay();
    const timeVal = now.getHours() * 60 + now.getMinutes();
    const daysBackToSunday = day === 0 && timeVal >= 17 * 60 ? 0 : day;
    start.setDate(now.getDate() - daysBackToSunday);
    start.setHours(17, 0, 0, 0);
    return start;
  }

  if (type === "PMDB") {
    const timeVal = now.getHours() * 60 + now.getMinutes();
    if (timeVal < 6 * 60 + 30) start.setDate(now.getDate() - 1);
    start.setHours(17, 30, 0, 0);
    return start;
  }

  if (type === "ADB") {
    start.setHours(11, 0, 0, 0);
    return start;
  }

  start.setHours(6, 30, 0, 0);
  return start;
}

export function isBriefCurrentForWindow(
  brief: Pick<BriefRecord, "created_at" | "content"> | null | undefined,
  type: BriefType,
  nowInput = new Date(),
): boolean {
  if (!brief?.created_at) return false;
  const createdAt = toNewYorkWallDate(new Date(brief.created_at));
  const windowStart = getBriefWindowStart(type, nowInput);
  return (
    createdAt >= windowStart &&
    briefContentMatchesCurrentDate(brief.content, nowInput)
  );
}

function briefContentMatchesCurrentDate(
  content: string | undefined,
  nowInput: Date,
): boolean {
  if (!content) return false;
  const header = content.slice(0, 800);
  const match = header.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i,
  );
  if (!match) return true;
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const statedMonth = monthNames.indexOf(match[1].toLowerCase()) + 1;
  const statedDay = Number(match[2]);
  const statedYear = Number(match[3]);
  const current = toNewYorkWallDate(nowInput);
  return (
    statedYear === current.getFullYear() &&
    statedMonth === current.getMonth() + 1 &&
    statedDay === current.getDate()
  );
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
  const today = dateInNewYork(new Date());

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

  // [claude-code 2026-04-28] S47-T2: diagnostic timestamp comparison
  if (briefType === "PMDB") {
    try {
      const { getChamberReadFreshness } = await import("./arbitrum/index.js");
      const freshness = await getChamberReadFreshness();
      log.info("PMDB Chamber Read freshness", {
        latest_pmdb_at: freshness.latest_pmdb_at,
        latest_session_verdict_at: freshness.latest_session_verdict_at,
        gap_minutes: freshness.gap_minutes,
        chamberReadPresent: !!chamberRead,
      });
    } catch {
      // Non-fatal diagnostic
    }
  }

  // [S45-T1] Inline Desk Theme block — pre-formatted, monospace gutter,
  // pulled from today's day_plan. MDB / ADB / PMDB / TWT all carry it.
  const deskThemeBlock = await fetchDeskThemeBlock(today);
  const deskThemeSection = deskThemeBlock ? `\n${deskThemeBlock}\n` : "";
  const macroDoctrineSection = await loadMacroEventCognitionBlock();

  const isFull = briefType === "MDB" || briefType === "TWT";

  const prompt = isFull
    ? `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a comprehensive ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Brief Date (America/New_York)
${today}

## Recent RiskFlow Headlines
${feedSummary}
${macroDoctrineSection}
${deskThemeSection}
${CATALYST_CASCADE_TABLE_RULES}

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

CRITICAL: Only reference data from the headlines and events provided above. Do NOT fabricate price levels, percentage moves, stock tickers, or actual/forecast numbers that aren't in the input. If you don't have specific data, say so — never hallucinate. NEVER use emojis, decorative unicode symbols, or ASCII art of any kind. Use plain Markdown headers, bullet points, and bold text only.

Be direct, use financial shorthand. Anchor ONLY to key macro events. 300-500 words. NEVER use emojis or decorative unicode symbols.`
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

## Brief Date (America/New_York)
${today}

## Recent RiskFlow Headlines
${feedSummary}
${macroDoctrineSection}
${chamberSection}${deskThemeSection}
${CATALYST_CASCADE_TABLE_RULES}

## Instructions
${
  briefType === "ADB"
    ? "Write 3-5 bullet points covering ONLY new headlines and data since the morning that moved or could move the market. Skip anything already covered in the MDB. Be direct and actionable. Max 200 words. NEVER use emojis."
    : chamberRead
      ? "Write the PMDB (Post-Market Daily Brief) for Thursday, May 7, 2026. Use plain Markdown — no emojis, no decorative symbols. Format as: ## PMDB header, then bullet-point sections covering new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Lead with a 1-sentence restatement of the Chamber Read consensus above, flag any dissent, then the bullets. Be direct and actionable. Max 300 words."
      : "Write the PMDB (Post-Market Daily Brief) for today. Use plain Markdown — no emojis, no decorative symbols. Format as: ## PMDB header, then bullet-point sections covering new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Be direct and actionable. Max 300 words."
}`;

  log.info("Generating brief via DeepSeek primary provider chain...", {
    briefType,
  });
  const result = await generateViaChain({
    systemPrompt:
      "You are Fintheon, PIC's macro event-risk desk assistant. Calendar consensus is baseline only; PIC internal forecast and second-order event-risk cognition drive every brief. NEVER use emojis or decorative unicode symbols — plain Markdown only. Use ## headers, bullet points (-), and **bold** text.",
    prompt,
    model: "deepseek-reasoner",
    temperature: 0.4,
    maxOutputTokens: isFull ? 4096 : 1024,
    timeoutMs: 180_000,
  });
  const text = result.response;
  const usedProvider = result.provider;
  assertUsableBriefContent(text, briefType);
  log.info(`Brief provider chain generated ${text.length} chars`, {
    provider: usedProvider,
  });

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

  // [claude-code 2026-05-13] S64-T1: After TWT generation, trigger week desk plan generation.
  if (briefType === "TWT") {
    void (async () => {
      try {
        const { triggerWeekPlan } = await import("./desk-planner.js");
        await triggerWeekPlan();
        log.info("Week desk plan triggered from TWT publish");
      } catch (err) {
        log.warn("TWT->desk-plan trigger failed (non-fatal)", {
          error: String(err),
        });
      }
    })();
  }

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
  return (
    latest !== null &&
    isUsableBriefContent(latest.content) &&
    isBriefCurrentForWindow(latest, type)
  );
}
