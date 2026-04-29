// [claude-code 2026-04-29] S49: Rewrote SYSTEM_PROMPT, sanitizeTheme, and
//   fallbackTheme to produce a <=160 char actionable plan (not a brief recap).
//   sanitizeTheme now hard-caps at 160 chars on a word boundary.
// [claude-code 2026-04-26] S45-T1: Desk Theme generator. Composes a prompt from
// today's top RiskFlow catalyst, IV score, planned window + prices, and asks
// claude-sonnet-4-6 (via VProxy at localhost:8317) for a single-sentence theme
// message that ties the day's setup to its catalyst. Plain text only — no
// emojis, no decorative glyphs.

import { invokeAgent } from "../strands/index.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("DeskTheme");

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

const SYSTEM_PROMPT = `You write actionable Desk Plan messages for Priced In Capital traders. The output is a plan, not a recap — it tells the trader what to do at the levels.

Output rules:
- Exactly one sentence, no more than 160 characters total (including spaces).
- Plain text only. No emojis, no decorative glyphs, no headers, no quotes.
- Reference behavior at the levels: fade, target, abandon below. The sentence must include specific price actions tied to the given levels.
- The catalyst may be named in 1–3 words for context, but the sentence body must be about the trade plan, not about restating the catalyst.
- Financial shorthand allowed (CPI, PCE, /NQ, VIX) but no fabricated numbers — only use the prices provided.
- Do NOT include phrasing copied from any daily brief (MDB/ADB/PMDB).
- Voice is sharp, convicted, declarative — never hedging.`;

export async function generateDeskTheme(
  input: DeskThemeInput,
): Promise<string> {
  const prompt = buildPrompt(input);

  try {
    const result = await invokeAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      model: {
        model: "claude-sonnet-4-6",
        temperature: 0.55,
        maxTokens: 200,
      },
    });
    return sanitizeTheme(result.text) || fallbackTheme(input);
  } catch (err) {
    log.warn("Desk theme generation failed — using fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackTheme(input);
  }
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
  if (input.pricesOfInterest.length > 0) {
    lines.push(`Prices of interest: ${input.pricesOfInterest.join(", ")}`);
  }
  lines.push("");
  lines.push(
    "Write the single Desk Theme sentence that explains why these levels matter today given the catalyst.",
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
  const entry =
    input.pricesOfInterest.length > 0
      ? input.pricesOfInterest[0].toFixed(0)
      : null;
  const target =
    input.pricesOfInterest.length > 1
      ? input.pricesOfInterest[input.pricesOfInterest.length - 1].toFixed(0)
      : null;
  const invalidation =
    input.pricesOfInterest.length > 1
      ? input.pricesOfInterest[1].toFixed(0)
      : entry;
  const parts: string[] = [];
  parts.push(`${input.windowLabel} ET ${input.instrument}`);
  if (entry) parts.push(`fade ${entry}`);
  if (target) parts.push(`target ${target}`);
  if (invalidation) parts.push(`abandon below ${invalidation}`);
  const sentence = parts.join(", ") + ".";
  if (sentence.length <= 160) return sentence;
  return `${input.windowLabel} ET ${input.instrument}${entry ? `: fade ${entry}` : ""}.`;
}
