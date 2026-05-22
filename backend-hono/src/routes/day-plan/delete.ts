import type { Context } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("DayPlanDelete");

export async function handleDeleteDayPlan(c: Context): Promise<Response> {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "missing_id" }, 400);

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "supabase_unavailable" }, 503);

  const { error: windowError } = await sb
    .from("day_plan_windows")
    .delete()
    .eq("day_plan_id", id);
  if (windowError) {
    log.warn("day_plan_windows delete failed", {
      id,
      error: windowError.message,
    });
    return c.json({ error: "window_delete_failed" }, 500);
  }

  const { error: planError } = await sb.from("day_plans").delete().eq("id", id);
  if (planError) {
    log.warn("day_plans delete failed", { id, error: planError.message });
    return c.json({ error: "plan_delete_failed" }, 500);
  }

  return c.json({ ok: true, deletedId: id });
}
