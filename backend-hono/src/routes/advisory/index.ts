// [claude-code 2026-04-23] S32-T7: Advisory endpoints — passive size suggestion
// derived from account state + recent P&L. Never enforced, never blocks orders.

import { Hono } from "hono";
import type { Context } from "hono";
import { suggestSize } from "../../services/advisory/size-suggestion.js";

async function loadRecentPnl(userId: string, limit = 5): Promise<number[]> {
  try {
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return [];
    const { data } = await sb
      .from("trades")
      .select("pnl")
      .eq("user_id", userId)
      .order("exit_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (!Array.isArray(data)) return [];
    return data
      .map((row) => Number((row as { pnl?: number | string }).pnl ?? 0))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export function createAdvisoryRoutes(): Hono {
  const router = new Hono();

  router.get("/size", async (c: Context) => {
    const contract = c.req.query("contract") ?? "";
    const proposedSize = Number(c.req.query("proposedSize") ?? "0");
    if (!contract || !Number.isFinite(proposedSize) || proposedSize <= 0) {
      return c.json(
        { error: "contract and positive proposedSize are required" },
        400,
      );
    }

    const defaultSize = Number(c.req.query("defaultSize") ?? proposedSize);
    const accountBalance = c.req.query("accountBalance")
      ? Number(c.req.query("accountBalance"))
      : undefined;
    const previousOpenBalance = c.req.query("previousOpenBalance")
      ? Number(c.req.query("previousOpenBalance"))
      : undefined;

    const uid = c.get("supabaseUid") as string | undefined;
    const recentPnl = uid ? await loadRecentPnl(uid) : [];

    const result = suggestSize({
      contract,
      proposedSize,
      defaultSize,
      accountBalance,
      previousOpenBalance,
      recentPnl,
    });

    return c.json(result);
  });

  return router;
}
