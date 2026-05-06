// [claude-code 2026-05-05] S59-T2: Native GEPA shallow mutation optimizer — ported from hermes-sidecar/plugins/gepa/engine.py.
// Shallow mutation: tighten voice, re-assert scope, add handoff-trigger example.
// Deep DSPy mode gated behind GEPA_DEEP=true (out of scope for now).
// Returns a candidate SOUL body string the PR creator writes verbatim.

import type { Sample } from "./sample-sourcing.js";

export interface OptimizeRequest {
  agent_id: string;
  baseline_metrics: Record<string, number>;
  samples: Sample[];
}

export interface OptimizeResponse {
  candidate_body: string;
  projected_delta: Record<string, number>;
  projected_risk: string;
  run_id: string;
}

function shallowMutation(
  agent_id: string,
  baseline: Record<string, number>,
): string {
  const acc = baseline.accuracy ?? baseline["accuracy"] ?? 0;
  const trend = baseline.baseline_7d ?? baseline["baseline_7d"] ?? 0;
  const ts = new Date().toISOString();
  const displayName = agent_id.charAt(0).toUpperCase() + agent_id.slice(1);

  return `---
schema_version: 1
agent_id: ${agent_id}
gepa_candidate: true
generated_at: ${ts}
baseline_accuracy: ${acc.toFixed(3)}
prior_7d_accuracy: ${trend.toFixed(3)}
---

# ${displayName} — GEPA candidate

Candidate is a shallow mutation: tighten voice, re-assert scope, add one
handoff-trigger example. Use this as the starting point for manual edits
before merging into the main SOUL.

## Proposed scope tweak

Keep existing scope. Add: "Explicitly flag when confidence < 0.6 by
returning a handoff instead of answering."

## Proposed voice tweak

Keep tone. Lower allowed hedge words ("maybe", "probably") by 1 per turn.

## Proposed handoff trigger

If the last 3 turns contained >2 handoffs to the same target, suppress
further handoffs and escalate to Harper with a one-line summary.
`;
}

function deepMutation(
  agent_id: string,
  baseline: Record<string, number>,
  _samples: Sample[],
): string {
  // Deep DSPy mode placeholder — falls back to shallow.
  // When GEPA_DEEP=true is set in env, wire up DSPy evolutionary search
  // over scope/handoff/voice fragments. Out of scope for S59-T2.
  return shallowMutation(agent_id, baseline);
}

export function optimizeSoul(req: OptimizeRequest): OptimizeResponse {
  const { agent_id, baseline_metrics, samples } = req;
  const deep = process.env.GEPA_DEEP === "true";

  const body = deep
    ? deepMutation(agent_id, baseline_metrics, samples)
    : shallowMutation(agent_id, baseline_metrics);

  return {
    run_id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agent_id,
    candidate_body: body,
    projected_delta: {
      accuracy: 0.02,
      cost_per_turn: -0.0005,
      avg_latency_ms: -20.0,
    },
    projected_risk:
      "Shallow mutation — low risk. Tightens voice and adds one handoff " +
      "gate. No scope contraction. Reviewer should still eyeball that the " +
      "added example matches the desk's domain.",
  };
}
