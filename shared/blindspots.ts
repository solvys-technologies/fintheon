// [claude-code 2026-04-23] S31-T6 — cross-platform Blindspot type

export interface Blindspot {
  id: string;
  userId: string;
  date: string;
  pattern: string;
  evidence: string;
  correctiveAction: string;
  severity: 1 | 2 | 3 | 4 | 5;
  source: "template" | "fluid";
  createdAt: string;
}

export type BlindspotCategory = "psych" | "trading";

export const PSYCH_BLINDSPOT_PATTERNS = [
  "revenge_entry",
  "size_escalation",
  "post_loss_cluster",
  "fomo_entry",
] as const;

export const TRADING_BLINDSPOT_PATTERNS = [
  "over_trading",
  "over_leverage",
  "high_vol_env",
  "news_trading_early",
  "plan_deviation",
] as const;

export type PsychBlindspotPattern = (typeof PSYCH_BLINDSPOT_PATTERNS)[number];
export type TradingBlindspotPattern =
  (typeof TRADING_BLINDSPOT_PATTERNS)[number];
