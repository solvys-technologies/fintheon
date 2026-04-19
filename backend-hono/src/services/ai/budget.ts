// [claude-code 2026-04-19] S27-T9 W2e: per-user daily LLM budget — graceful degrade for Harper/Oracle.
//   Reads + upserts into public.user_budget_daily. Never a hard cutoff.
//   ROUTING_DISABLE_BUDGET=true skips the whole layer (TP override).

import { getSupabaseClient } from "../../config/supabase.js";
import type { AgentId, RoutingRule } from "./routing.js";
import { ROUTING_TABLE } from "./routing.js";

const DEFAULT_CAP_USD = Number(process.env.ROUTING_DAILY_CAP ?? "20");
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

function today(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isBudgetDisabled(): boolean {
  return process.env.ROUTING_DISABLE_BUDGET === "true";
}

export interface BudgetStatus {
  user_id: string;
  day: string;
  used_usd: number;
  cap_usd: number;
  degraded: boolean;
}

/**
 * Returns the caller's current budget status for today.
 * Creates a new row on first read for the day.
 */
export async function getBudgetStatus(
  userId: string | undefined,
): Promise<BudgetStatus> {
  const user_id = userId ?? SYSTEM_USER_ID;
  const day = today();
  const cap_usd = DEFAULT_CAP_USD;

  const sb = getSupabaseClient();
  if (!sb) {
    return { user_id, day, used_usd: 0, cap_usd, degraded: false };
  }

  const { data } = await sb
    .from("user_budget_daily")
    .select("used_usd, cap_usd, degraded")
    .eq("user_id", user_id)
    .eq("day", day)
    .maybeSingle();

  if (!data) {
    return { user_id, day, used_usd: 0, cap_usd, degraded: false };
  }
  return {
    user_id,
    day,
    used_usd: Number(data.used_usd ?? 0),
    cap_usd: Number(data.cap_usd ?? cap_usd),
    degraded: Boolean(data.degraded),
  };
}

/**
 * Atomic-ish upsert — adds cost + flips degraded flag when cap crossed.
 * Fire-and-forget from llm-call.ts, so we swallow failures and log.
 */
export async function addSpend(
  userId: string | undefined,
  cost_usd: number,
): Promise<void> {
  if (cost_usd <= 0) return;
  if (isBudgetDisabled()) return;

  const sb = getSupabaseClient();
  if (!sb) return;

  const user_id = userId ?? SYSTEM_USER_ID;
  const day = today();
  try {
    const { data } = await sb
      .from("user_budget_daily")
      .select("used_usd, cap_usd")
      .eq("user_id", user_id)
      .eq("day", day)
      .maybeSingle();

    const prev = Number(data?.used_usd ?? 0);
    const cap = Number(data?.cap_usd ?? DEFAULT_CAP_USD);
    const next = Number((prev + cost_usd).toFixed(6));
    const degraded = next >= cap;

    await sb.from("user_budget_daily").upsert(
      {
        user_id,
        day,
        used_usd: next,
        cap_usd: cap,
        degraded,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day" },
    );
  } catch (err) {
    console.warn("[budget] addSpend failed", err);
  }
}

/**
 * Apply degrade rules per the T9 spec: Harper/Oracle Opus → Sonnet.
 * Feucht/Herald stay Haiku. Consul stays Sonnet.
 */
export function applyDegrade(rule: RoutingRule): RoutingRule {
  const degradeTarget: Partial<Record<AgentId, string>> = {
    harper: "claude-sonnet-4-6",
    oracle: "claude-sonnet-4-6",
  };
  const target = degradeTarget[rule.agent];
  if (!target) return rule;
  const sonnet = ROUTING_TABLE.find((r) => r.agent === "consul");
  return {
    ...rule,
    model: target,
    cost_per_mtoken_in_usd: sonnet?.cost_per_mtoken_in_usd ?? 3,
    cost_per_mtoken_out_usd: sonnet?.cost_per_mtoken_out_usd ?? 15,
  };
}
