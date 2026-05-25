import type { Context } from "hono";
import {
  addCustomDeskPlanEvent,
  CustomDeskPlanSchema,
} from "../../services/day-plan/custom-desk-plan.js";

export async function handlePostCustomDeskPlan(c: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = CustomDeskPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      400,
    );
  }

  const result = await addCustomDeskPlanEvent(parsed.data);
  return c.json({
    ok: true,
    plan: result.plan,
    eventId: result.eventId,
  });
}
