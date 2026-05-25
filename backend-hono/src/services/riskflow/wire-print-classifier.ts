// [claude-code 2026-04-30] S55: WIRE word-gate classifier. Replaces
// emoji-dependent live-print classification with pure word gates.
// Applied only to approved WIRE source accounts (FinancialJuice, DeItaOne).
//
// Gates:
//   Econ: WIRE post contains both "Actual" and "Forecast"
//   Earnings: WIRE post contains "EPS" and either "REV" or "Revenue"

export type WirePrintClass = "econ" | "earnings" | "none";

export interface WirePrintResult {
  class: WirePrintClass;
  gate: string | null;
  matched: string[];
}

/**
 * Classify a WIRE post by word gate. Returns "econ" or "earnings" only when
 * the corresponding gate matches. Returns "none" otherwise — the post may
 * still be a valid wire post (commentary, headline relay) but is not a
 * live econ/earnings print candidate.
 */
export function classifyWirePrint(text: string): WirePrintResult {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  // Econ gate: requires BOTH "Actual" and "Forecast"
  const hasActual = /\bactual\b/i.test(text);
  const hasForecast = /\bforecast\b/i.test(text);
  const hasPrevious = /\bprevious\b/i.test(text);

  if (hasActual && hasForecast) {
    if (hasActual) matched.push("actual");
    if (hasForecast) matched.push("forecast");
    if (hasPrevious) matched.push("previous");
    return { class: "econ", gate: "actual+forecast", matched };
  }

  // Earnings gate: requires "EPS" and either "REV" or "Revenue"
  const hasEPS = /\beps\b/i.test(text);
  const hasREV = /\brev\b/i.test(text);
  const hasRevenue = /\brevenue\b/i.test(text);

  if (hasEPS && (hasREV || hasRevenue)) {
    if (hasEPS) matched.push("eps");
    if (hasREV) matched.push("rev");
    if (hasRevenue) matched.push("revenue");
    return { class: "earnings", gate: "eps+rev/revenue", matched };
  }

  return { class: "none", gate: null, matched };
}

/**
 * Quick check: is this text a WIRE econ print candidate?
 */
export function isEconWirePrint(text: string): boolean {
  return classifyWirePrint(text).class === "econ";
}

/**
 * Quick check: is this text a WIRE earnings print candidate?
 */
export function isEarningsWirePrint(text: string): boolean {
  return classifyWirePrint(text).class === "earnings";
}
