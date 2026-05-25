// [claude-code 2026-05-13] S64-T1: prices now come from TV scanner via day-plan-service pipeline.
//   No direct price-fetching change needed — pricesOfInterest is passed in.
// [claude-code 2026-04-29] S49: Rewrote SYSTEM_PROMPT, sanitizeTheme, and
//   fallbackTheme to produce a <=160 char actionable plan (not a brief recap).
//   sanitizeTheme now hard-caps at 160 chars on a word boundary.
// [claude-code 2026-04-26] S45-T1: Desk Theme generator. Composes a prompt from
// today's top RiskFlow catalyst, IV score, planned window + prices, and asks
// DeepSeek for a single-sentence theme that ties the day's setup to its
// catalyst. Plain text only — no emojis, no decorative glyphs.

import { invokeAgent } from "../strands/index.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("DeskTheme");
const THEME_TIMEOUT_MS = 20_000;

export interface DeskThemeInput {
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** Top headline / event driving the day. */
  catalystHeadline: string;
  /** Macro level / IV score 0-10. */
  ivScore: number | null;
  /** Optional name of the dominant scheduled event. */
  eventName?: string | null;
  /** "HH:MM-HH:MM" America/New_York. */
  windowLabel: string;
  /** Instrument the day-plan keys off (default /NQ). */
  instrument: string;
  /** Rounded prices of interest (entries). */
  pricesOfInterest: number[];
  /** Current regime label, e.g. "BULL_TREND". */
  regime?: string | null;
}

const SYSTEM_PROMPT = `You write actionable Desk Plan messages for Priced In Capital traders. The output is a plan, not a recap — it tells the trader what to expect from the catalyst.

Output rules:
- Exactly one sentence, no more than 160 characters total (including spaces).
- Plain text only. No emojis, no decorative glyphs, no headers, no quotes.
- Describe the trade setup around the catalyst: what the event means, how it could move markets, and what traders should watch for.
- The catalyst may be named in 1–3 words for context, but the sentence body must be about the trading implications, not restating the catalyst.
- Financial shorthand allowed (CPI, PCE, /NQ, VIX). No fabricated numbers.
- Do NOT include phrasing copied from any daily brief (MDB/ADB/PMDB).
- Voice is sharp, convicted, declarative — never hedging.`;

export async function generateDeskTheme(
  input: DeskThemeInput,
): Promise<string> {
  const prompt = buildPrompt(input);

  try {
    const result = await withTimeout(
      invokeAgent({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: prompt,
        model: {
          model: "deepseek-reasoner",
          temperature: 0.55,
          maxTokens: 200,
        },
        provider: "deepseek-direct",
      }),
      THEME_TIMEOUT_MS,
    );
    return sanitizeTheme(result.text) || fallbackTheme(input);
  } catch (err) {
    log.warn("Desk theme generation failed — using fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackTheme(input);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Desk theme generation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function buildPrompt(input: DeskThemeInput): string {
  const lines: string[] = [];
  lines.push(`Date: ${input.date}`);
  if (input.eventName) lines.push(`Scheduled event: ${input.eventName}`);
  lines.push(`Top RiskFlow catalyst: ${input.catalystHeadline}`);
  if (input.ivScore != null)
    lines.push(`IV score: ${input.ivScore.toFixed(1)} / 10`);
  if (input.regime) lines.push(`Market regime: ${input.regime}`);
  lines.push(`Trading window: ${input.windowLabel} ET on ${input.instrument}`);
  lines.push("");
  lines.push(
    "Write the single Desk Theme sentence that explains the trade setup around today's catalyst and what traders should expect.",
  );
  return lines.join("\n");
}

function sanitizeTheme(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  // Drop emoji + sparkle ranges.
  text = text.replace(/[☀-➿\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}]/gu, "");
  text = text.replace(/\s+/g, " ").trim();
  // Keep only the first sentence.
  const match = text.match(/^[^.!?]*[.!?]/);
  text = match ? match[0].trim() : text;
  // Hard-cap at 160 characters on a word boundary.
  if (text.length > 160) {
    const truncated = text.slice(0, 160);
    const lastSpace = truncated.lastIndexOf(" ");
    text = lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated;
    // Append a period if the cut left it without terminal punctuation.
    if (!/[.!?]$/.test(text)) text += ".";
  }
  return text;
}

function fallbackTheme(input: DeskThemeInput): string {
  if (input.eventName) {
    return `${input.windowLabel} ET ${input.instrument}: trade the ${input.eventName} print.`;
  }
  return `${input.windowLabel} ET ${input.instrument}: standing trading window.`;
}
