// [claude-code 2026-04-27] S46.4: ECON_BURST_INTERVAL_MS 500→1000 per TP — 1Hz
// burst poll inside the release window is enough to catch the first wire flash
// and halves outbound rate during high-frequency releases.
// [claude-code 2026-04-25] S40-P2: News-worker contract — locked cadence
// values. Mirror of NEWS_WORKER_CONTRACT.md. Boot-time assertion reads from
// this constant; scheduler reads from this constant. Only one place to update,
// and changes require sprint brief + TP signoff.

export const NEWS_WORKER_CONTRACT = {
  BREAKING_INTERVAL_MS: 60_000, // 60s wire handles
  COMMENTARY_INTERVAL_MS: 60_000, // 60s commentary handles
  STANDARD_INTERVAL_MS: 300_000, // 5m standard tier sweep
  ECON_BURST_ARM_OFFSET_MS: 30_000, // T-30s before scheduled release
  ECON_BURST_INTERVAL_MS: 1_000, // 1s during release window — was 500ms (S46.4)
  ECON_BURST_WINDOW_MS: 90_000, // 90s burst window
  HEALTH_CHECK_MS: 60_000, // watchdog ping cadence
  STALE_THRESHOLD_SEC: 300, // ageSec >= this → ok=false
  AUTO_RESTART_THRESHOLD_SEC: 300, // worker restart trigger
  DEAD_RECONNECT_ATTEMPTS: 30, // 30+ failed reconnects → notify "manual intervention required"
} as const;

export type NewsWorkerContract = typeof NEWS_WORKER_CONTRACT;
