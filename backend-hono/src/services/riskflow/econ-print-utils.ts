// [claude-code 2026-04-26] S45.5/F2: extracted from the deleted
// rettiwt-poller-econ.ts so econ-keyword-trigger keeps its keyword-first gate
// + numeric extraction primitives. These are pure parsing helpers — nothing
// rettiwt-specific lived inside them.

import type { EconEvent } from "../econ-calendar-service.js";

export const PRE_EVENT_MINUTES = 5;
export const POST_EVENT_MINUTES = 15;

const ACTUAL_PATTERNS = [
  /\bActual[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bActual[:\s]+(-?\d+\.?\d*)\s*[KkMm]?\b/i,
  /\b(?:came\s+in\s+at|prints?|reported)\s+(-?\d+\.?\d*)\s*%?/i,
];

const FORECAST_PATTERNS = [
  /\bForecast[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\b(?:exp|expected|consensus|est)[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bvs\.?\s+(?:forecast|exp|expected)\s+(-?\d+\.?\d*)\s*%?/i,
];

const PREVIOUS_PATTERNS = [
  /\bPrevious[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bPrev[:\s]+(-?\d+\.?\d*)\s*%?/i,
  /\bPrior[:\s]+(-?\d+\.?\d*)\s*%?/i,
];

export interface ExtractedActual {
  actual: number;
  forecast?: number;
  previous?: number;
}

export function extractActualFromText(text: string): ExtractedActual | null {
  let actualStr: string | undefined;
  for (const pattern of ACTUAL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      actualStr = match[1];
      break;
    }
  }
  if (!actualStr) return null;
  const actual = parseFloat(actualStr);
  if (isNaN(actual)) return null;

  let forecast: number | undefined;
  for (const pattern of FORECAST_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      forecast = parseFloat(match[1]);
      break;
    }
  }

  let previous: number | undefined;
  for (const pattern of PREVIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      previous = parseFloat(match[1]);
      break;
    }
  }

  return { actual, forecast, previous };
}

export function matchTweetToEvent(
  tweetText: string,
  events: EconEvent[],
): EconEvent | null {
  const upper = tweetText.toUpperCase();
  let bestMatch: EconEvent | null = null;
  let bestScore = 0;

  for (const event of events) {
    const eventUpper = event.name.toUpperCase();
    const keywords = eventUpper.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const kw of keywords) {
      if (upper.includes(kw)) score++;
    }
    if (eventUpper.includes("CPI") && upper.includes("CPI")) score += 3;
    if (eventUpper.includes("PPI") && upper.includes("PPI")) score += 3;
    if (eventUpper.includes("NFP") && upper.includes("NFP")) score += 3;
    if (eventUpper.includes("GDP") && upper.includes("GDP")) score += 3;
    if (eventUpper.includes("PCE") && upper.includes("PCE")) score += 3;
    if (eventUpper.includes("FOMC") && upper.includes("FOMC")) score += 3;
    if (eventUpper.includes("RETAIL") && upper.includes("RETAIL")) score += 2;
    if (eventUpper.includes("CLAIMS") && upper.includes("CLAIMS")) score += 2;
    if (eventUpper.includes("PMI") && upper.includes("PMI")) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}
