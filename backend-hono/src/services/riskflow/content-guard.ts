// [claude-code 2026-04-12] Pre-ingestion content guard — blocks garbage before it hits raw_riskflow_items
// Catches: slurs, profanity, political spam, junk slang, drunk/incoherent text, @ mention replies
// This is a PROFESSIONAL trading platform. Zero tolerance for non-market content.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("ContentGuard");

// ── Racial / ethnic / homophobic slurs ──────────────────────────────────────
// Hard block — zero tolerance. Includes leetspeak variants.
const SLUR_PATTERNS = [
  // N-word variants
  /\bn[i1!][g9]{1,2}[ae3]r?s?\b/i,
  /\bn[i1!][g9]{1,2}[ae3]?\b/i,
  /\bn[i1!][g9]{1,2}[aeu3]h?\b/i,
  // Anti-semitic
  /\bk[i1!]ke[s]?\b/i,
  // Anti-Hispanic
  /\bsp[i1!]c[ks]?\b/i,
  /\bwetback[s]?\b/i,
  /\bbeaner[s]?\b/i,
  // Anti-Asian
  /\bch[i1!]nk[s]?\b/i,
  /\bgook[s]?\b/i,
  /\bch[i1!]ng\s*ch[o0]ng/i,
  /\bslant[\s-]?eye/i,
  // Anti-Arab / Middle Eastern
  /\brag\s*head[s]?\b/i,
  /\btowel\s*head[s]?\b/i,
  /\bsand\s*n[i1!]gg/i,
  /\bcamel\s*jockey/i,
  // Anti-Black (other)
  /\bcoon[s]?\b/i,
  /\bdarkie[s]?\b/i,
  /\bjigaboo/i,
  /\bporch\s*monkey/i,
  // General slurs
  /\bfagg?[o0]t[s]?\b/i,
  /\bdyke[s]?\b/i,
  /\btrann[yi]/i,
  /\bretard(ed|s)?\b/i,
];

// ── Profanity / junk language ───────────────────────────────────────────────
// Hard block — this is a professional platform, not Twitter replies.
// Only blocks when these appear as the DOMINANT content (not buried in a headline).
const JUNK_LANGUAGE_PATTERNS = [
  /\b(lol|lmao|lmfao|rofl|roflmao)\b/i,
  /\b(simp|simping|simps)\b/i,
  /\b(stfu|gtfo|foh|smfh)\b/i,
  /\b(clown\s*world|honk\s*honk)\b/i,
  /\b(cope|copium|seethe|mald|malding)\b/i,
  /\b(ratio|ratioed|L\s+take|W\s+take)\b/i,
  /\b(deez\s+nuts|ligma|sugma)\b/i,
  /\b(bruh|bruhhh|bro\s+what|fam|no\s+cap|bussin|deadass|fr\s+fr|ong|ngl)\b/i,
  /\b(sus|sussy|amogus)\b/i,
  /\b(based\s+and|redpill|blackpill|whitepill)\b/i,
  /\b(normie|chad|virgin|incel|beta\s*male|alpha\s*male|sigma)\b/i,
  /\b(cuck|soy\s*boy|snowflake|libtard|conservatard|demoncrat|republicunt)\b/i,
  /\b(rekt|wrecked|owned|pwned)\b/i,
  /\b(cringe|yikes|oof|sheesh)\b/i,
  /\b(wtf|smh|smfh|omfg|jfc)\b/i,
  /\bcomedy\b/i,
  /\bblurb\b/i,
  /\bno[\s-]no\b/i,
  /\bunverified\b/i,
  /\bdeepfake\b/i,
  /\bTucker\s+Carlson\b/i,
];

// ── Political spam / partisan noise ─────────────────────────────────────────
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
  /\bfascist[s]?\b/i,
  /\bcommie[s]?\b/i,
  /\bmarxi[st]/i,
  /\bwoke\s+(capitalism|agenda|ideology)\b/i,
  /\banti[\s-]?woke\b/i,
  /\bblue\s*anon\b/i,
  /\bdemocRAT\b/,
  /\bRepubliKKKan\b/i,
  /\bTrump\s+derangement\b/i,
  /\b(Biden|Kamala|AOC)\s+(regime|cartel|crime)\b/i,
];

// ── Drunk / incoherent text ─────────────────────────────────────────────────
function isDrunkText(text: string): boolean {
  let signals = 0;

  // Excessive caps ratio (>60% caps in text with 20+ alpha chars)
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 20) {
    const capsRatio =
      alphaChars.replace(/[^A-Z]/g, "").length / alphaChars.length;
    if (capsRatio > 0.6) signals++;
  }

  // Repeated characters (4+ of same char): "yesssss", "nooooo"
  if (/(.)\1{3,}/i.test(text)) signals++;

  // Excessive exclamation/question marks (3+)
  if (/[!?]{3,}/.test(text)) signals++;

  // Very short text with no substance (under 30 chars, no financial keywords)
  if (
    text.length < 30 &&
    !/\b(fed|cpi|ppi|gdp|nfp|fomc|tariff|rate|yield|treasury|earnings|vix|opec|sanctions?|missile|war)\b/i.test(
      text,
    )
  )
    signals++;

  // Excessive emoji count (5+)
  const emojiCount = (
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ) || []
  ).length;
  if (emojiCount >= 5) signals++;

  return signals >= 2;
}

// ── @ Mention / RT detection ────────────────────────────────────────────────
function isAtMentionOrRT(text: string): boolean {
  const trimmed = text.trim();
  // Starts with @user — reply
  if (/^@\w+/.test(trimmed)) return true;
  // Starts with RT — retweet
  if (/^RT\s+@/i.test(trimmed)) return true;
  // Any @ mention anywhere — not a professional wire headline
  if (/@\w+/.test(trimmed)) return true;
  // Any RT prefix
  if (/^RT\b/i.test(trimmed)) return true;
  return false;
}

// ── Emoji filter ────────────────────────────────────────────────────────────
// Only FJ severity emojis (🔴⚠️🚨🟡🟠🔵) are allowed. Any other emoji = noise.
const FJ_ALLOWED_EMOJIS = new Set(["🔴", "⭕", "⚠️", "🚨"]);

function hasNonFJEmojis(text: string): boolean {
  const allEmojis =
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1F300}-\u{1F5FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ) || [];
  if (allEmojis.length === 0) return false;
  // If ALL emojis are FJ severity indicators, allow
  return allEmojis.some((e) => !FJ_ALLOWED_EMOJIS.has(e));
}

// ── "false" prefix ──────────────────────────────────────────────────────────
// Items starting with "false" are fact-check / debunk content, not wire news.
function startsWithFalse(text: string): boolean {
  return /^\s*false\b/i.test(text);
}

// ── Market relevance gate ───────────────────────────────────────────────────
// If a headline has ZERO financial/market keywords, it's noise.
// This catches the "White House UFC" / "Obama" / comedy podcast garbage that
// slips through because it doesn't trigger slur/profanity/political patterns.

const MARKET_KEYWORDS =
  /\b(tariff|trade\s+war|sanction|executive\s+order|bill\s+sign|deficit|spending|budget|tax|debt|rate|inflation|CPI|PPI|GDP|NFP|FOMC|Fed\b|Treasury|yield|bond|equity|stock|futures|oil|crude|gold|VIX|earnings|revenue|IPO|merger|acquisition|bankruptcy|default|downgrade|upgrade|PMI|jobless|unemployment|retail\s+sales|housing|consumer|manufacturing|import|export|supply\s+chain|semiconductor|chip|OPEC|barrel|EIA|DOE|refinery|pipeline|LNG|natgas|interest\s+rate|basis\s+point|hike|cut|hawkish|dovish|tightening|easing|QE|QT|balance\s+sheet|repo|liquidity|margin|leverage|short|long|hedge|derivative|swap|option|put|call|strike|expiry|settlement|clearing|regulation|SEC|CFTC|DOJ|antitrust|compliance|stimulus|infrastructure|appropriation|continuing\s+resolution|shutdown|ceiling|sequester|reconciliation|USMCA|NATO|AUKUS|BRICS|G7|G20|IMF|World\s+Bank|WTO|BIS|ceasefire|escalat|de-?escalat|retaliati|mobiliz|airstrike|missile|nuclear|military|deploy|naval|carrier|drone|IRGC|Houthi|Hezbollah|IDF|Pentagon|CENTCOM|strait|blockade|proxy|invasion|annex|occupation|incursion)\b/i;

function lacksMarketRelevance(text: string): boolean {
  // Short texts get more leniency (could be wire flash)
  if (text.length < 60) return false;
  // If it has ANY market keyword, it's potentially relevant
  if (MARKET_KEYWORDS.test(text)) return false;
  // No market keywords in 60+ char text = noise
  return true;
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
  // 1. Slurs — hardest block
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "slur" };
    }
  }

  // 2. Junk language / profanity
  for (const pattern of JUNK_LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "junk-language" };
    }
  }

  // 3. Political spam
  for (const pattern of POLITICAL_SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "political-spam" };
    }
  }

  // 4. @ mention or RT — not professional wire content
  if (isAtMentionOrRT(text)) {
    return { blocked: true, reason: "at-mention-or-rt" };
  }

  // 5. Non-FJ emojis — professional wire headlines don't have 😂🔥💀
  if (hasNonFJEmojis(text)) {
    return { blocked: true, reason: "non-fj-emoji" };
  }

  // 6. "false" prefix — fact-check/debunk, not wire news
  if (startsWithFalse(text)) {
    return { blocked: true, reason: "false-prefix" };
  }

  // 7. Market relevance — no financial keywords = noise
  if (lacksMarketRelevance(text)) {
    return { blocked: true, reason: "no-market-relevance" };
  }

  // 8. Drunk / incoherent
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
