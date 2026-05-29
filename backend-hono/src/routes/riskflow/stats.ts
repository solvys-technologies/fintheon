import type { Context } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";

interface HeartbeatRow {
  items_ingested: number | null;
}

function sumHeartbeatRows(rows: HeartbeatRow[] | null) {
  return (rows ?? []).reduce(
    (sum, row) => sum + Number(row.items_ingested ?? 0),
    0,
  );
}

export async function handleGetRiskFlowStats(c: Context) {
  const sb = getSupabaseClient();
  if (!sb) {
    return c.json({
      ok: false,
      totalIngested: null,
      scoredItems: null,
      heartbeatIngested: null,
      error: "Supabase unavailable",
    });
  }

  try {
    const [scoredResult, heartbeatResult] = await Promise.all([
      sb.from("scored_riskflow_items").select("id", {
        count: "exact",
        head: true,
      }),
      sb.from("riskflow_worker_heartbeats").select("items_ingested"),
    ]);
    const scoredItems = scoredResult.count ?? null;
    const heartbeatIngested = sumHeartbeatRows(
      (heartbeatResult.data ?? null) as HeartbeatRow[] | null,
    );

    return c.json({
      ok: !scoredResult.error,
      totalIngested: scoredItems ?? heartbeatIngested,
      scoredItems,
      heartbeatIngested,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      ok: false,
      totalIngested: null,
      scoredItems: null,
      heartbeatIngested: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
