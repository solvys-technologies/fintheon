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

const SYSTEM_PROMPT = `You write Desk Theme messages for Priced In Capital traders.

Output rules:
- Exactly one sentence. No more.
- Plain text only. No emojis, no decorative glyphs, no headers, no quotes.
- Tie the day's trading window to the named catalyst in concrete terms — what edge does the catalyst create at these levels?
- Financial shorthand allowed (CPI, PCE, /NQ, VIX) but no fabricated numbers.
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
  // Keep only the first sentence to enforce the "one sentence" rule.
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0].trim() : text;
}

function fallbackTheme(input: DeskThemeInput): string {
  const levelHint =
    input.pricesOfInterest.length > 0
      ? ` around ${input.pricesOfInterest.join(" / ")}`
      : "";
  const catalyst = input.eventName ?? input.catalystHeadline;
  return `${input.windowLabel} ET ${input.instrument} window keys off ${catalyst}${levelHint}.`;
}
