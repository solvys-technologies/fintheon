// [claude-code 2026-04-12] Rettiwt poller accounts — DB-backed with hardcoded fallback
// Reads from riskflow_source_accounts table. Falls back to hardcoded lists if DB unreachable.

import { getAccountHandles } from "../source-accounts/source-accounts-service.js";

// ── Hardcoded fallback (used when DB is unreachable) ──────────────────────

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

// Priority accounts polled EVERY cycle
const PRIORITY_HANDLES = new Set<string>([...FJ_ACCOUNTS, ...WIRE_ACCOUNTS]);
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

/** Get accounts for this poll cycle: priority + next batch of rotating accounts */
export function getAccountsForCycle(): string[] {
  // Synchronous — uses hardcoded lists for immediate use
  // The econ-rettiwt-poller calls this synchronously; async DB reads happen at higher level
  const batch: string[] = [...PRIORITY_HANDLES];
  const rotating = [...ALL_CONTINUOUS_ACCOUNTS].filter(
    (a) => !PRIORITY_HANDLES.has(a),
  );
  for (let i = 0; i < ROTATION_BATCH_SIZE; i++) {
    batch.push(rotating[(rotationIndex + i) % rotating.length]);
  }
  rotationIndex = (rotationIndex + ROTATION_BATCH_SIZE) % rotating.length;
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
