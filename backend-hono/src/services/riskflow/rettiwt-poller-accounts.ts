// [claude-code 2026-04-19] Cut from Herald dispatcher during S27-T4. Left inert for fast re-enable. Delete in S29 if browser-harness coverage holds. Do NOT remove imports elsewhere without replacing data source.
// [claude-code 2026-04-12] Rettiwt poller accounts — DB-backed with hardcoded fallback
// Reads from riskflow_source_accounts table. Falls back to hardcoded lists if DB unreachable.

import {
  getAccountHandles,
  getActiveAccounts,
} from "../source-accounts/source-accounts-service.js";

// ── Hardcoded fallback (used when DB is unreachable on cold boot) ────────

export const FJ_ACCOUNTS = ["financialjuice"] as const;
export const TRUSTED_ACCOUNTS = ["NickTimiraos"] as const;
export const WIRE_ACCOUNTS = ["DeItaone"] as const;
export const OSINT_ACCOUNTS = ["OSINTDefender"] as const;
export const GEOPOLITICAL_ACCOUNTS = [
  "SecBessent25",
  "realDonaldTrump",
  "ABORNEOFFICIAL",
  "TheSpectatorIndex",
  "SchizoIntel",
  "MenchOSINT",
  "ClashReport",
] as const;

export const ALL_CONTINUOUS_ACCOUNTS = [
  ...FJ_ACCOUNTS,
  ...TRUSTED_ACCOUNTS,
  ...WIRE_ACCOUNTS,
  ...OSINT_ACCOUNTS,
  ...GEOPOLITICAL_ACCOUNTS,
] as const;

const ROTATION_BATCH_SIZE = 3;
let rotationIndex = 0;

/** Fetch active handles — DB first, hardcoded fallback */
export async function getActiveAccountHandles(): Promise<string[]> {
  try {
    const handles = await getAccountHandles();
    if (handles.length > 0) return handles;
  } catch {
    // DB unreachable — fall through to hardcoded
  }
  return [...ALL_CONTINUOUS_ACCOUNTS];
}

/**
 * [claude-code 2026-04-26] Get accounts for this poll cycle: priority (Wire +
 * Macro categories from the user-managed DB list) + a rotating batch of all
 * other active accounts. Now async + DB-driven so adds/removes from the
 * Refinement Engine actually drive what news the worker pulls. Falls back to
 * hardcoded ALL_CONTINUOUS_ACCOUNTS when the DB is unreachable.
 */
export async function getAccountsForCycle(): Promise<string[]> {
  let priority: string[] = [];
  let rotating: string[] = [];
  try {
    const active = await getActiveAccounts();
    if (active.length > 0) {
      const wireMacro = active
        .filter((a) => a.category === "Wire" || a.category === "Macro")
        .map((a) => a.handle);
      const others = active
        .filter((a) => a.category !== "Wire" && a.category !== "Macro")
        .map((a) => a.handle);
      priority = wireMacro;
      rotating = others;
    }
  } catch {
    /* DB unreachable — fall through */
  }
  if (priority.length === 0 && rotating.length === 0) {
    priority = [...FJ_ACCOUNTS, ...WIRE_ACCOUNTS];
    rotating = [...ALL_CONTINUOUS_ACCOUNTS].filter(
      (a) => !priority.includes(a),
    );
  }
  const batch: string[] = [...priority];
  if (rotating.length > 0) {
    for (let i = 0; i < ROTATION_BATCH_SIZE; i++) {
      batch.push(rotating[(rotationIndex + i) % rotating.length]);
    }
    rotationIndex = (rotationIndex + ROTATION_BATCH_SIZE) % rotating.length;
  }
  return [...new Set(batch)];
}

// Geopolitical search terms — burst-polled when conflict escalation detected
export const GEOPOLITICAL_SEARCH_TERMS = [
  "Iran IRGC strike",
  "Israel Iran missile",
  "Houthi Red Sea attack",
  "Hezbollah escalation",
  "Trump tariff announce",
  "Bessent treasury",
] as const;

// Max results per search / timeline call
export const SEARCH_LIMIT = 20;
export const TIMELINE_LIMIT = 30;
