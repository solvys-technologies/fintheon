// [claude-code 2026-04-30] Immutable RiskFlow Guidelines — source of truth
// for feed quality, content filtering, and scoring. These rules are NEVER to
// be reverted or regressed. Every autonomous agent (Harper, Hermes, central
// scorer) MUST reference this file before making feed changes.
//
// When the central scorer, content guard, or any autonomous task mutates the
// feed, it checks these guidelines for invariant rules. Violations are
// hard-blocked with an ops-log entry.
//
// Format: each entry is a { rule, reason, immutable_since } triple.

export interface ImmutableRule {
  rule: string;
  reason: string;
  immutable_since: string; // ISO date
}

export const IMMUTABLE_RULES: ImmutableRule[] = [
  // ── Banned Personalities (podcasters, pundits, provocateurs) ──────────
  {
    rule: "NEVER surface content mentioning or quoting Dan Bongino, Tucker Carlson, Candace Owens, or Nick Fuentes. Hard-block at content-guard gate.",
    reason: "Non-financial political provocateurs. Zero relevance to market analysis.",
    immutable_since: "2026-04-30",
  },
  {
    rule: "NEVER surface content from or citing any podcast/pundit in the political-commentary sphere unless they hold an official government or central bank position.",
    reason: "Podcaster opinions do not move markets and degrade feed signal-to-noise ratio.",
    immutable_since: "2026-04-30",
  },

  // ── Banned Language Patterns ──────────────────────────────────────────
  {
    rule: "NEVER surface headlines containing 'dragged' in a non-market-data context (e.g. 'dragged markets lower'). Block as speculative junk.",
    reason: "Vague, directionless language that confuses severity classification.",
    immutable_since: "2026-04-30",
  },
  {
    rule: "NEVER surface headlines containing 'lets you trade' or 'trade like'. These are promotional/advertising patterns, not market information.",
    reason: "Advertising and platform promos have no place in the RiskFlow feed.",
    immutable_since: "2026-04-30",
  },

  // ── Source Policy (NEVER revert) ──────────────────────────────────────
  {
    rule: "NEVER re-add Bloomberg, Reuters, CNBC, CNN, Fox News, WSJ, FT, Barrons, MarketWatch, Business Insider, ZeroHedge, or SeekingAlpha to the allowed source list. The publisher-blocklist MUST remain intact.",
    reason: "MSM noise degrades RiskFlow precision. Per TP directive: approved sources are FRED, BLS, Federal Reserve, FinancialJuice, DeItaOne only.",
    immutable_since: "2026-04-26",
  },
  {
    rule: "NEVER remove speculation-filter demotion (0.7x factor). Hedged-language wire items MUST be scored lower than confirmed data.",
    reason: "Speculation-filter prevents 'reportedly', 'sources say', 'could trigger' noise from inflating IV scores.",
    immutable_since: "2026-04-28",
  },

  // ── Content Quality Gates (NEVER remove) ──────────────────────────────
  {
    rule: "NEVER remove content-guard gates 1-9 (slurs, junk language, political spam, scraper artifacts, emoji filter, speculation filter, false-prefix, non-financial agencies, market relevance).",
    reason: "Professional trading platform. Zero tolerance for non-market content.",
    immutable_since: "2026-04-12",
  },
  {
    rule: "NEVER remove the dismissed-pattern filter. User feedback (thumbs-down) MUST persist and feed into future scoring decisions.",
    reason: "User feedback is the primary signal for feed quality improvement.",
    immutable_since: "2026-04-30",
  },

  // ── Score Integrity ───────────────────────────────────────────────────
  {
    rule: "NEVER allow IV scoring without VIX context. VIX rescore multiplier MUST be applied in all scoring runs.",
    reason: "IV without VIX context inflates severity during calm markets and understates risk during volatility.",
    immutable_since: "2026-03-11",
  },
  {
    rule: "NEVER allow macroLevel 0 items to surface in the frontend. Items that fail narrative gate, dismissed-pattern match, or content guard MUST be dropped.",
    reason: "macroLevel 0 items are explicitly rejected by the pipeline.",
    immutable_since: "2026-04-30",
  },

  // ── Autonomous Task Routing ───────────────────────────────────────────
  {
    rule: "Autonomous feed-quality tasks (scoring-qa, feed-quality-feedback, batch-review-low-priority, pipeline-stall) MUST route through Hermes (DeepSeek v4 Pro) via the hermes-handler, not the deprecated Harper autonomous Claude CLI loop.",
    reason: "Harper autonomous subprocess loop is deprecated per 2026-04-17. Claude Code Routines drive Harper Ops; DeepSeek drives feed-quality autonomous tasks.",
    immutable_since: "2026-04-30",
  },
];

/**
 * Check if a headline or body violates any immutable rule.
 * Returns the first violated rule, or null if clean.
 */
export function checkImmutableRules(
  headline: string,
  body?: string,
): ImmutableRule | null {
  const text = `${headline} ${body ?? ""}`.toLowerCase();

  // Banned personalities
  const BANNED_PERSONALITIES = [
    "dan bongino",
    "tucker carlson",
    "candace owens",
    "nick fuentes",
  ];
  if (BANNED_PERSONALITIES.some((p) => text.includes(p))) {
    return IMMUTABLE_RULES[0];
  }

  // Banned patterns
  if (/\bdragged\b/i.test(text)) {
    return IMMUTABLE_RULES[2];
  }
  if (/\blets\s+you\s+trade\b/i.test(text) || /\btrade\s+like\b/i.test(text)) {
    return IMMUTABLE_RULES[3];
  }

  return null;
}

/**
 * Final sanity check before any item enters the scored feed.
 * Must pass ALL immutable rules. Called by central-scorer and hermes-handler.
 */
export function validateAgainstGuidelines(
  headline: string,
  body?: string,
): { passed: boolean; violation?: ImmutableRule } {
  const violation = checkImmutableRules(headline, body);
  if (violation) {
    return { passed: false, violation };
  }
  return { passed: true };
}
