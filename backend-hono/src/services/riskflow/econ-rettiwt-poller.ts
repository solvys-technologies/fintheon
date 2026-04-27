// [claude-code 2026-04-27] v5.33.5: Stripped to a no-op shim. The original
// file hardcoded AGENT_REACH_URLS with reuters.com / cnbc.com /
// zerohedge.com — permanently retired per TP ("Strip MSM hardcoded URLs").
// Rettiwt itself was already killed in S45.5/F2.
//
// Exported names preserved so existing import sites (boot/services.ts,
// routes/{riskflow/handlers, diagnostics/index}.ts, services/riskflow/
// {feed-service, feed-poller}.ts) continue to compile. Every function is
// a no-op or returns an empty result.

import type { FeedItem } from "../../types/riskflow.js";

export function isRettiwtRateLimited(): boolean {
  return false;
}

export function getRettiwtCooldownMs(): number {
  return 0;
}

export function getWarmCacheItems(): FeedItem[] {
  return [];
}

export async function pollForEconNews(): Promise<FeedItem[]> {
  return [];
}

export async function manualRefresh(): Promise<FeedItem[]> {
  return [];
}

export function startEconPoller(): void {
  /* dead-wired */
}

export function stopEconPoller(): void {
  /* dead-wired */
}
