// [claude-code 2026-04-12] Pre-ingestion content guard — blocks garbage before it hits raw_riskflow_items
// Catches: political spam (MAGA), racial slurs, drunk/incoherent text, @ mention replies

import { createLogger } from "../../lib/logger.js";

const log = createLogger("ContentGuard");

// ── Political spam / partisan noise ─────────────────────────────────────────
// These are NOT market-moving — they're partisan cheerleading or rage-bait.
const POLITICAL_SPAM_PATTERNS = [
  /\bMAGA\b/,
  /\bMake\s+America\s+Great\b/i,
  /\bTrump\s+2028\b/i,
  /\bTrump\s+won\b/i,
  /\bstolen\s+election\b/i,
  /\bstop\s+the\s+steal\b/i,
  /\bdeep\s+state\b/i,
  /\bwoke\s+mob\b/i,
  /\bLGBT\b.*\b(agenda|groomer)\b/i,
  /\bLet'?s\s+go\s+Brandon\b/i,
  /\bFJB\b/,
  /\bBrandon\s+(administration|regime)\b/i,
  /\bDrain\s+the\s+swamp\b/i,
  /\bBuild\s+the\s+wall\b/i,
  /\bWWG1WGA\b/i,
  /\bQAnon\b/i,
  /\bgreat\s+awakening\b/i,
  /\bplandemic\b/i,
  /\bsheeple\b/i,
];

// ── Racial / ethnic slurs ───────────────────────────────────────────────────
// Hard block — zero tolerance. Case-insensitive word-boundary matches.
const SLUR_PATTERNS = [
  /\bn[i1]gg[ae3]r?s?\b/i,
  /\bn[i1]gg[ae3]?\b/i,
  /\bk[i1]ke[s]?\b/i,
  /\bsp[i1]c[s]?\b/i,
  /\bch[i1]nk[s]?\b/i,
  /\bwetback[s]?\b/i,
  /\bcoon[s]?\b/i,
  /\bdarkie[s]?\b/i,
  /\brag\s*head[s]?\b/i,
  /\btowel\s*head[s]?\b/i,
  /\bgook[s]?\b/i,
  /\bbeaner[s]?\b/i,
  /\bjigaboo\b/i,
  /\bsand\s*n[i1]gg/i,
];

// ── Drunk / incoherent text ─────────────────────────────────────────────────
// Heuristics for text that reads like someone hammered on Twitter at 2 AM.
// We check multiple signals and require 2+ to flag.

function isDrunkText(text: string): boolean {
  let signals = 0;

  // Excessive caps ratio (>60% caps in a text with 20+ chars)
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 20) {
    const capsRatio =
      alphaChars.replace(/[^A-Z]/g, "").length / alphaChars.length;
    if (capsRatio > 0.6) signals++;
  }

  // Repeated characters (3+ of same char in a row): "yesssss", "nooooo"
  if (/(.)\1{3,}/i.test(text)) signals++;

  // Excessive exclamation/question marks (3+)
  if (/[!?]{3,}/.test(text)) signals++;

  // Internet slang / drunk abbreviations
  if (
    /\b(rdy|lmao|lmfao|bruh|fam|yall|ngl|frfr|ong|bussin|deadass|sus|copium)\b/i.test(
      text,
    )
  )
    signals++;

  // Very short text with no substance (under 30 chars, no financial keywords)
  if (
    text.length < 30 &&
    !/\b(fed|cpi|ppi|gdp|nfp|fomc|tariff|rate|yield|treasury|earnings)\b/i.test(
      text,
    )
  )
    signals++;

  // Excessive emoji count (5+ non-FJ emojis)
  const emojiCount = (
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ) || []
  ).length;
  if (emojiCount >= 5) signals++;

  return signals >= 2;
}

// ── @ Mention detection ─────────────────────────────────────────────────────
// Tweets that START with @ are replies, not original news.
// Tweets with 3+ @ mentions are conversations, not headlines.

function isAtMentionNoise(text: string): boolean {
  // Starts with @user — it's a reply, not a headline
  if (/^@\w+/.test(text.trim())) return true;

  // 3+ @ mentions — it's a conversation thread, not news
  const mentionCount = (text.match(/@\w+/g) || []).length;
  if (mentionCount >= 3) return true;

  return false;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ContentGuardResult {
  blocked: boolean;
  reason: string | null;
}

/**
 * Run all content guards on a headline/body.
 * Returns { blocked: true, reason } if the item should be dropped.
 * Call this BEFORE writing to raw_riskflow_items.
 */
export function checkContentGuard(text: string): ContentGuardResult {
  // 1. Slurs — hardest block, check first
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "slur" };
    }
  }

  // 2. Political spam
  for (const pattern of POLITICAL_SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "political-spam" };
    }
  }

  // 3. @ mention noise
  if (isAtMentionNoise(text)) {
    return { blocked: true, reason: "at-mention-noise" };
  }

  // 4. Drunk / incoherent
  if (isDrunkText(text)) {
    return { blocked: true, reason: "incoherent" };
  }

  return { blocked: false, reason: null };
}

/**
 * Filter an array of items with a text accessor.
 * Returns only items that pass the content guard.
 * Logs blocked items for audit trail.
 */
export function filterWithContentGuard<T>(
  items: T[],
  getText: (item: T) => string,
): T[] {
  const passed: T[] = [];
  let blockedCount = 0;
  const blockedReasons: Record<string, number> = {};

  for (const item of items) {
    const text = getText(item);
    const result = checkContentGuard(text);
    if (result.blocked) {
      blockedCount++;
      blockedReasons[result.reason!] =
        (blockedReasons[result.reason!] || 0) + 1;
    } else {
      passed.push(item);
    }
  }

  if (blockedCount > 0) {
    log.info(
      `Blocked ${blockedCount}/${items.length} items: ${JSON.stringify(blockedReasons)}`,
    );
  }

  return passed;
}
