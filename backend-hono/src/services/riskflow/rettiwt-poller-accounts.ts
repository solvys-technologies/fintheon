// [claude-code 2026-04-11] Rettiwt poller account lists + rotation logic
// Ported from twitter-cli/econ-triggered-poller.ts — same accounts, Rettiwt transport

// FinancialJuice is the primary source of truth for econ print actuals.
export const FJ_ACCOUNTS = ["financialjuice"] as const;

// Trusted macro/econ accounts — always polled alongside FJ
export const TRUSTED_ACCOUNTS = ["NickTimiraos"] as const;

// Breaking news / market-moving wire accounts — continuous polling
export const WIRE_ACCOUNTS = ["DeItaone"] as const;

// OSINT / geopolitical intelligence accounts — continuous polling
export const OSINT_ACCOUNTS = ["OSINTDefender"] as const;

// Geopolitical + policy accounts — polled for real-time geopolitical + fiscal commentary
export const GEOPOLITICAL_ACCOUNTS = [
  "SecBessent25",
  "realDonaldTrump",
  "ABORNEOFFICIAL",
  "TheSpectatorIndex",
  "SchizoIntel",
  "MenchOSINT",
  "ClashReport",
] as const;

// All accounts that should be polled continuously (not gated by econ events)
export const ALL_CONTINUOUS_ACCOUNTS = [
  ...FJ_ACCOUNTS,
  ...TRUSTED_ACCOUNTS,
  ...WIRE_ACCOUNTS,
  ...OSINT_ACCOUNTS,
  ...GEOPOLITICAL_ACCOUNTS,
] as const;

// Priority accounts polled EVERY cycle. Others rotate in batches of 3.
const PRIORITY_ACCOUNTS: readonly string[] = [...FJ_ACCOUNTS, ...WIRE_ACCOUNTS];
const ROTATING_ACCOUNTS: readonly string[] = ALL_CONTINUOUS_ACCOUNTS.filter(
  (a) => !PRIORITY_ACCOUNTS.includes(a),
);
let rotationIndex = 0;
const ROTATION_BATCH_SIZE = 3;

/** Get accounts for this poll cycle: priority + next batch of rotating accounts */
export function getAccountsForCycle(): string[] {
  const batch: string[] = [...PRIORITY_ACCOUNTS];
  for (let i = 0; i < ROTATION_BATCH_SIZE; i++) {
    batch.push(
      ROTATING_ACCOUNTS[(rotationIndex + i) % ROTATING_ACCOUNTS.length],
    );
  }
  rotationIndex =
    (rotationIndex + ROTATION_BATCH_SIZE) % ROTATING_ACCOUNTS.length;
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
