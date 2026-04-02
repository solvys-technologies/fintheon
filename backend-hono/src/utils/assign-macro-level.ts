import type { MacroLevel, RiskType } from '../types/riskflow.js';
import { CATALYST_LEVEL_CRITERIA } from '../config/catalyst-levels.js';

export interface MacroLevelInput {
  ivScore: number; // normalized 0-100
  fjEmojiTier: string; // 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'none'
  riskType: RiskType;
  keywordMatches: string[]; // matched keywords from headline-parser
  urgencySignals: number; // count of urgency signals from enrichFeedWithAnalysis
  sdSurprise?: number; // standard deviation surprise for econ data (optional)
}

export function assignMacroLevel(input: MacroLevelInput): MacroLevel {
  const { ivScore, fjEmojiTier, riskType, keywordMatches, urgencySignals, sdSurprise } = input;
  const criteria = CATALYST_LEVEL_CRITERIA;

  // Level 4: IV at floor OR tier1 emoji OR SD surprise > threshold
  if (
    ivScore >= criteria[4].ivThreshold ||
    criteria[4].fjEmojiTiers.some((tier) => tier === fjEmojiTier) ||
    (sdSurprise !== undefined && sdSurprise >= criteria[4].sdSurpriseThreshold) ||
    keywordMatches.some((k) => criteria[4].keywords.some((keyword) => keyword === k))
  ) {
    return 4;
  }

  // Level 3: IV at floor OR tier2 emoji + (riskType match OR 2+ urgency signals)
  if (
    (ivScore >= criteria[3].ivThreshold && urgencySignals >= 1) ||
    (criteria[3].fjEmojiTiers.some((tier) => tier === fjEmojiTier) &&
      criteria[3].riskTypes.some((type) => type === riskType)) ||
    (keywordMatches.some((k) => criteria[3].keywords.some((keyword) => keyword === k)) &&
      urgencySignals >= 2)
  ) {
    return 3;
  }

  // Level 2: IV at floor OR matching keywords OR tier3 emoji
  if (
    ivScore >= criteria[2].ivThreshold ||
    criteria[2].fjEmojiTiers.some((tier) => tier === fjEmojiTier) ||
    keywordMatches.some((k) => criteria[2].keywords.some((keyword) => keyword === k))
  ) {
    return 2;
  }

  // Default: Level 1
  return 1;
}
