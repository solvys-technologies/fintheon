// [claude-code 2026-04-27] v5.33.5: Stripped to a no-op shim. The original
// file hardcoded an RSS_FEEDS list with reuters.com / bloomberg.com /
// cnbc.com / marketwatch.com / seekingalpha.com / zerohedge.com URLs —
// permanently retired per TP ("Strip MSM hardcoded URLs"). The riskflow-worker
// (separate Fly app fintheon-riskflow-worker, see workers/riskflow-worker/)
// is the SINGLE writer to raw_riskflow_items now. Boot wiring already
// stripped in S46.3.
//
// The exported names are kept so existing import sites (boot/services.ts,
// routes/riskflow/handlers.ts, services/riskflow/poll-watchdog.ts) continue
// to compile. Every function is a no-op.

import type { RawRiskFlowItem } from "../supabase-service.js";

export const AGENT_REACH_POLLER_NAME = "agent-reach";

export function startAgentReachPoller(): void {
  /* dead-wired — riskflow-worker is the single writer */
}

export function stopAgentReachPoller(): void {
  /* dead-wired */
}

export async function pollAgentReach(): Promise<RawRiskFlowItem[]> {
  return [];
}

export async function agentReachTick(): Promise<void> {
  /* dead-wired */
}
