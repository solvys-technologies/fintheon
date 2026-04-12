// [claude-code 2026-03-10] Financial Juice tier filter — emoji-first, keyword fallback for X/Twitter feed

export type FJTier = "critical" | "high" | "medium" | "low";
export type FJUrgency = "immediate" | "high" | "normal";

export interface FJClassification {
  tier: FJTier;
  macroLevel: 1 | 2 | 3 | 4;
  urgency: FJUrgency;
  shouldInclude: boolean;
}

const CANONICAL_FJ_EMOJIS = ["🚨", "⚠️", "🔴", "🟠", "🟡", "🔵"] as const;

/**
 * FJ emoji tiers (Discord/Telegram format):
 *   🔴 Critical — FOMC, NFP, CPI actuals, major geopolitical
 *   ⚠️🚨 High  — Fed speakers, GDP, retail, earnings
 *   🟡🟠 Medium — PMI, housing, jobless claims, sector
 *   🔵 Low      — commentary → skip
 *
 * On X/Twitter, FJ does NOT use emoji prefixes.
 * Fallback: keyword-based importance scoring.
 */

// ── Emoji tier table ─────────────────────────────────────────────────────────

const EMOJI_TIERS: Array<{
  emoji: string;
  tier: FJTier;
  macroLevel: 1 | 2 | 3 | 4;
  urgency: FJUrgency;
}> = [
  { emoji: "🔴", tier: "critical", macroLevel: 4, urgency: "immediate" },
  { emoji: "⚠️", tier: "high", macroLevel: 3, urgency: "high" },
  { emoji: "🚨", tier: "high", macroLevel: 3, urgency: "high" },
  { emoji: "🟡", tier: "medium", macroLevel: 2, urgency: "normal" },
  { emoji: "🟠", tier: "medium", macroLevel: 2, urgency: "normal" },
];

// ── Keyword fallback (X/Twitter feed — no emojis) ─────────────────────────────

/**
 * Critical — prints that move markets immediately
 * Match: "Actual X.X% (Forecast Y.Y%)" data release patterns + policy decisions
 */
const CRITICAL_PATTERNS = [
  /\bActual\b/i, // economic data release
  /\bFOMC\b/i,
  /\bFed\s+(raises|cuts|hikes|holds|decision)\b/i,
  /\bNFP\b/i,
  /\bNon[\s-]?Farm\b/i,
  /\bCPI\b.*\bActual\b/i,
  /\bPPI\b.*\bActual\b/i,
  /\bGDP\b.*\bActual\b/i,
  /\brate\s+(hike|cut|hold|decision)\b/i,
  /\bemergency\s+(meeting|rate|action)\b/i,
];

/**
 * High impact — major policy, geopolitical flash points, key speaker statements
 * Covers: econ data, Fed speakers, geopolitical escalation, defense/OSINT intel
 */
const HIGH_PATTERNS = [
  /\b(Powell|Lagarde|Waller|Jefferson|Williams|Bessent|Yellen)\b/i, // Fed speakers + Treasury
  /\b(ECB|BOE|BOJ|PBOC|RBA|Fed)\s+(says|warns|signals|confirms|cuts|raises)\b/i,
  /\bsanction(s)?\b/i,
  /\bwar\b.*\b(Iran|Russia|China|Ukraine)\b/i,
  /\b(Iran|Israel|China|Russia|North Korea)\b.*\b(attack|missile|nuclear|military)\b/i,
  /\bGDP\b/i,
  /\bRetail\s+Sales\b/i,
  /\bExisting\s+Home\s+Sales\b/i,
  /\bJobless\s+Claims\b/i,
  /\bISM\b/i,
  /\bPMI\b.*\bActual\b/i,
  /\bTreasury\b.*\b(auction|yield|bill|bond)\b/i,
  /\bOPEC\b/i,
  /\bsupply\s+cut\b/i,
  /\bCPI\b/i,
  /\bPPI\b/i, // even without "Actual", CPI/PPI mentions are high
  /\bDebt\s+ceiling\b/i,
  /\bdefault\b.*\b(US|Treasury|sovereign)\b/i,
  // OSINT / geopolitical escalation patterns (OSINTDefender, DeItaOne)
  /\b(airstrike|bombing|drone\s+strike|ballistic|cruise\s+missile|ICBM)\b/i,
  /\b(IRGC|Houthi|Hezbollah|IDF|Pentagon|CENTCOM|NATO)\b/i,
  /\b(strait\s+of\s+hormuz|red\s+sea|taiwan\s+strait|south\s+china\s+sea)\b/i,
  /\b(ceasefire|escalat|de-?escalat|retaliati|mobiliz)\b/i,
  /\b(tariff|trade\s+war|import\s+dut|export\s+ban)\b/i,
  /\bBREAKING\b/, // DeItaOne "BREAKING:" prefix
];

/**
 * Medium — sector news, secondary data, policy commentary
 */
const MEDIUM_PATTERNS = [
  /\b(Housing|Building|Permits|Starts)\b/i,
  /\bPMI\b/i,
  /\bMarkit\b/i,
  /\bConsumer\s+Confidence\b/i,
  /\bSentiment\b/i,
  /\bEarnings\b.*\b(beat|miss|EPS|revenue)\b/i,
  /\b(Apple|Google|Microsoft|Tesla|Amazon|Meta|Nvidia|JPMorgan|Goldman)\b/i,
  /\b(crude|oil|WTI|Brent)\b/i,
  /\b(gold|silver|copper)\s+price\b/i,
  /\bIEA\b/i,
  /\bOPEC\b/i,
  /\bTrade\s+(war|tariff|deal|deficit|balance)\b/i,
  /\b(Maersk|shipping|supply chain)\b/i,
  /\b(fear|greed)\s+index\b/i,
  // OSINT conflict theater / military movement (medium when not direct escalation)
  /\b(deploy|convoy|troops|naval|carrier|submarine|warship|fighter\s+jet)\b/i,
  /\b(explosion|casualt|evacuat|refugee|humanitarian)\b/i,
  /\b(Ukraine|Syria|Yemen|Lebanon|Gaza|Taiwan)\b/i,
  /\b(sanctions?\s+list|blacklist|embargo)\b/i,
  // Wire service patterns (DeItaOne market-moving wires)
  /\b(upgrades?|downgrades?|price\s+target|initiates?)\s+(coverage|at|to)\b/i,
  /\b(halt|halted|resumed|circuit\s+breaker)\b/i,
  /\b(buyback|dividend|split|merger|acquisition|takeover|IPO)\b/i,
];

function keywordClassify(text: string): FJClassification {
  const t = text;
  for (const pattern of CRITICAL_PATTERNS) {
    if (pattern.test(t))
      return {
        tier: "critical",
        macroLevel: 4,
        urgency: "immediate",
        shouldInclude: true,
      };
  }
  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(t))
      return {
        tier: "high",
        macroLevel: 3,
        urgency: "high",
        shouldInclude: true,
      };
  }
  for (const pattern of MEDIUM_PATTERNS) {
    if (pattern.test(t))
      return {
        tier: "medium",
        macroLevel: 2,
        urgency: "normal",
        shouldInclude: true,
      };
  }
  return {
    tier: "low",
    macroLevel: 1,
    urgency: "normal",
    shouldInclude: false,
  };
}

// ── FJ Self-Promo / Joke Blacklist ───────────────────────────────────────────
// The guy running the FJ X account can't help himself — ads, jokes, GIFs, and
// hot takes get sprinkled between actual market-moving headlines. Filter them.

const BLACKLIST_PATTERNS = [
  /\bFinancialJuice\b/i, // self-promotion / platform mentions
  /financialjuice\.com/i, // links to site
  /\bdownload\b/i, // app promotion
  /\btry\s+(it|our|the)\b/i, // "try our app" etc
  /\bsubscribe\b/i,
  /\bjoin\s+(us|our)\b/i,
  /\bfree\s+trial\b/i,
  /\bsign\s+up\b/i,
  /\bpromo\s*code\b/i,
  /\bdiscount\b/i,
];

const BLACKLIST_EMOJIS = [
  "😂",
  "🤣",
  "😭",
  "💀",
  "😆",
  "😅",
  "🤡",
  "😜",
  "😝",
  "🤪",
  "😹",
  "🤣",
  "😀",
  "😁",
  "😄",
  "🤭",
  "🫠",
];

/**
 * Check if a tweet is FJ self-promotion, joke, or ad content.
 * Returns true if the tweet should be blacklisted.
 */
export function isFJBlacklisted(text: string, hasGif?: boolean): boolean {
  // Platform promotion / ads
  if (BLACKLIST_PATTERNS.some((p) => p.test(text))) return true;
  // Laughing emojis = editorial jokes, not news
  if (BLACKLIST_EMOJIS.some((e) => text.includes(e))) return true;
  // GIF-attached posts are promo or reaction content
  if (hasGif) return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const TIER_ORDER: Record<FJTier, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Return the first FinancialJuice-style severity emoji present in text.
 */
export function extractFJEmojiFromText(text: string): string | null {
  for (const emoji of CANONICAL_FJ_EMOJIS) {
    if (text.includes(emoji)) return emoji;
  }
  return null;
}

/**
 * Map a single emoji marker to the catalyst macro tier notation.
 */
export function fjTierFromEmoji(
  emoji: string | null,
): "tier1" | "tier2" | "tier3" | "tier4" | "none" {
  if (!emoji) return "none";
  if (emoji === "🚨" || emoji === "🔴") return "tier1";
  if (emoji === "⚠️") return "tier2";
  if (emoji === "🟠" || emoji === "🟡") return "tier3";
  return "tier4";
}

/**
 * Classify a tweet by emoji tier first; fall back to keyword scoring.
 * Covers both Discord/Telegram (emoji) and X/Twitter (no emoji) formats.
 */
export function classifyFJHeadline(
  text: string,
  hasGif?: boolean,
): FJClassification {
  // Blacklist check first — ads, jokes, promos never pass
  if (isFJBlacklisted(text, hasGif)) {
    return {
      tier: "low",
      macroLevel: 1,
      urgency: "normal",
      shouldInclude: false,
    };
  }
  for (const entry of EMOJI_TIERS) {
    if (text.includes(entry.emoji)) {
      return {
        tier: entry.tier,
        macroLevel: entry.macroLevel,
        urgency: entry.urgency,
        shouldInclude: true,
      };
    }
  }
  return keywordClassify(text);
}

/**
 * Filter an array of tweet-like objects to only those at minTier or above.
 */
export function filterByTier<T extends { text: string }>(
  items: T[],
  minTier: FJTier = "medium",
): Array<T & { fjClassification: FJClassification }> {
  const minLevel = TIER_ORDER[minTier];
  return items
    .map((item) => ({
      ...item,
      fjClassification: classifyFJHeadline(item.text),
    }))
    .filter(
      ({ fjClassification }) => TIER_ORDER[fjClassification.tier] >= minLevel,
    );
}
