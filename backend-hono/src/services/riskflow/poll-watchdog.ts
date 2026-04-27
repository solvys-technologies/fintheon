// [claude-code 2026-04-27] v5.33.5: Stripped to a no-op shim. Existed only
// to restart the legacy agent-reach-poller when its lastRunAt drifted; that
// poller is now a no-op and the riskflow-worker (separate Fly app) owns
// ingest. Boot wiring removed in S46.3. Exports kept so boot/services.ts +
// any legacy callers compile.

export function startPollWatchdog(): void {
  /* dead-wired */
}

export function stopPollWatchdog(): void {
  /* dead-wired */
}
