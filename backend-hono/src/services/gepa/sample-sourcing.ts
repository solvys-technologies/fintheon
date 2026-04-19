// [claude-code 2026-04-19] S27-T11 W2e: GEPA sample sourcing.
//   Three signals:
//     1. Explicit feedback — routing_decisions.user_feedback_score (1-5) when set
//     2. agent_memory rows with memory_type='accuracy_feedback'
//     3. Implicit handoff + RiskFlow follow-through signals (Herald → Feucht trade follow-through)

import { getSupabaseClient } from "../../config/supabase.js";

export interface Sample {
  agent_id: string;
  conversation_id: string | null;
  score: number; // 0-1 normalized
  source: "explicit" | "memory" | "handoff" | "riskflow-followthrough";
  created_at: string;
}

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

export async function sampleAgent(agent_id: string): Promise<Sample[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const since = new Date(Date.now() - WINDOW_24H_MS).toISOString();
  const out: Sample[] = [];

  // 1. Explicit feedback on routing_decisions
  const { data: explicit } = await sb
    .from("routing_decisions")
    .select("conversation_id, user_feedback_score, created_at")
    .eq("agent_id", agent_id)
    .gte("created_at", since)
    .not("user_feedback_score", "is", null);
  for (const row of explicit ?? []) {
    const score = Number(row.user_feedback_score ?? 0);
    if (!Number.isFinite(score) || score <= 0) continue;
    out.push({
      agent_id,
      conversation_id: row.conversation_id as string,
      score: (score - 1) / 4, // 1-5 → 0-1
      source: "explicit",
      created_at: row.created_at as string,
    });
  }

  // 2. agent_memory accuracy_feedback — may have .metadata.accuracy field
  try {
    const { data: memory } = await sb
      .from("agent_memory")
      .select("content, metadata, created_at")
      .eq("agent_id", agent_id)
      .eq("memory_type", "accuracy_feedback")
      .gte("created_at", since);
    for (const row of memory ?? []) {
      const meta = (row.metadata ?? {}) as { accuracy?: number };
      if (typeof meta.accuracy === "number") {
        out.push({
          agent_id,
          conversation_id: null,
          score: Math.max(0, Math.min(1, meta.accuracy)),
          source: "memory",
          created_at: row.created_at as string,
        });
      }
    }
  } catch {
    // table may not exist in early envs
  }

  // 3. Implicit — scored_riskflow_items → trade follow-through.
  //    If Herald promoted a catalyst and Feucht executed within 60m with positive PnL, score both +1.
  //    Skeleton only — concrete join depends on trade journal schema (kept conservative here).
  if (agent_id === "herald" || agent_id === "feucht") {
    try {
      const { data: trades } = await sb
        .from("trades")
        .select("pnl_usd, created_at, catalyst_id")
        .gte("created_at", since);
      for (const t of trades ?? []) {
        if (!t.catalyst_id) continue;
        const pnl = Number(t.pnl_usd ?? 0);
        out.push({
          agent_id,
          conversation_id: null,
          score: pnl > 0 ? 1 : 0,
          source: "riskflow-followthrough",
          created_at: t.created_at as string,
        });
      }
    } catch {
      // trades table may not yet exist
    }
  }

  return out;
}

export function meanScore(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((s, x) => s + x.score, 0) / samples.length;
}
