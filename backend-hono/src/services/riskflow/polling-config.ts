// [claude-code 2026-04-18] S25-T5: Tiered polling cadence (RTH / pre-post / overnight / weekend)
//   + hot-mode override when a Level 4 item has fired in the last HOT_WINDOW_MS.

export type PollingConfig = {
  interval: number;
  isHotHours: boolean;
  tier: "rth" | "pre-post" | "overnight" | "weekend" | "hot";
};

// Tier intervals (ms) — Agent Reach / feed-poller share the same table for now.
// Safe defaults per user instruction; the 30s turbo tier is deferred until Agent Reach
// hardening has 48h of clean telemetry.
const TIER_MS = {
  rth: 60_000, // 9:30–16:00 ET weekdays
  prePost: 60_000, // 4:00–9:30 + 16:00–20:00 ET weekdays
  overnight: 300_000, // 20:00–4:00 ET weekdays
  weekend: 600_000, // all day Sat/Sun
  hot: 15_000, // 30-min window after a Level 4 item
};

const HOT_WINDOW_MS = 30 * 60_000;
let hotModeUntil = 0;

/** Mark the next HOT_WINDOW_MS as hot-mode (called when a Level 4 item fires). */
export function triggerHotMode(): void {
  hotModeUntil = Date.now() + HOT_WINDOW_MS;
}

/** Returns the epoch ms when hot-mode ends, or null if not active. */
export function getHotModeUntil(): number | null {
  return hotModeUntil > Date.now() ? hotModeUntil : null;
}

function minutesSinceMidnightET(now: Date): number {
  const etNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return etNow.getHours() * 60 + etNow.getMinutes();
}

export function getPollingConfig(now = new Date()): PollingConfig {
  // Hot-mode beats every other tier.
  if (now.getTime() < hotModeUntil) {
    return { interval: TIER_MS.hot, isHotHours: true, tier: "hot" };
  }

  const etNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = etNow.getDay(); // 0 = Sunday, 6 = Saturday

  if (day === 0 || day === 6) {
    return { interval: TIER_MS.weekend, isHotHours: false, tier: "weekend" };
  }

  const mins = minutesSinceMidnightET(now);
  const RTH_START = 9 * 60 + 30; // 9:30
  const RTH_END = 16 * 60; // 16:00
  const PRE_START = 4 * 60; // 4:00
  const POST_END = 20 * 60; // 20:00

  if (mins >= RTH_START && mins < RTH_END) {
    return { interval: TIER_MS.rth, isHotHours: true, tier: "rth" };
  }
  if (
    (mins >= PRE_START && mins < RTH_START) ||
    (mins >= RTH_END && mins < POST_END)
  ) {
    return {
      interval: TIER_MS.prePost,
      isHotHours: false,
      tier: "pre-post",
    };
  }
  return {
    interval: TIER_MS.overnight,
    isHotHours: false,
    tier: "overnight",
  };
}
