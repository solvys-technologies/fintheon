// [claude-code 2026-04-19] S27-T4 (W1c): shared browser primitives barrel export.
// Consumers: Herald source router, T6 Harper Browser Operator, T7 News Worker.

export const BROWSER_PRIMITIVES_READY = true;

export {
  acquirePage,
  getPoolStats,
  isPlaywrightReady,
  pruneIdlePages,
  shutdownPool,
} from "./pool.js";
export type { PageHandle } from "./pool.js";

export {
  BROWSER_ALLOWLIST,
  findAllowlistEntry,
  getQuotaSnapshot,
  hasQuotaRemaining,
  hostname,
  incrementQuota,
} from "./allowlist.js";
export type {
  BrowserAllowlistEntry,
  BrowserAllowTier,
} from "./allowlist.js";

export {
  browseRead,
  browseReadWithFallback,
  BrowserBudgetExceededError,
  BrowserCircuitTrippedError,
  BrowserQuotaExceededError,
  getBreakerSnapshot,
  UniversalModeDisabledError,
  z,
} from "./harness.js";
export type {
  BrowseMode,
  BrowseOpts,
  BrowseResult,
  BrowseWaitFor,
} from "./harness.js";
