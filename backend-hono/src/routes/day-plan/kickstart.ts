import type { Context } from "hono";
import { z } from "zod";
import { createLogger } from "../../lib/logger.js";
import { generateDayPlan } from "../../services/day-plan/day-plan-service.js";

const log = createLogger("DayPlanKickstart");
const TEAM_ID = "pic";

const KickstartSchema = z
  .object({
    days: z.number().int().min(1).max(7).optional(),
  })
  .optional();

export async function handlePostKickstart(c: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = undefined;
  }

  const parsed = KickstartSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "invalid_body", detail: parsed.error.flatten() },
      400,
    );
  }

  const days = parsed.data?.days ?? 7;
  const dates = collectNextCalendarDates(days);
  const plans = [];
  const failures = [];

  for (const dateIso of dates) {
    try {
      const result = await generateDayPlan({
        teamId: TEAM_ID,
        date: new Date(`${dateIso}T12:00:00Z`),
        override: true,
        generatedBy: "desk-plan-kickstart",
      });
      plans.push({
        date: result.plan.date,
        windowCount: result.plan.windows.length,
        eventName: result.plan.eventName,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failures.push({ date: dateIso, error });
      log.warn("kickstart plan generation failed", { date: dateIso, error });
    }
  }

  return c.json({
    ok: failures.length === 0,
    days,
    planned: plans,
    failures,
    generatedAt: new Date().toISOString(),
  });
}

function collectNextCalendarDates(count: number): string[] {
  const dates: string[] = [];
  const cursor = dateInNewYork(new Date());
  while (dates.length < count) {
    dates.push(formatIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function dateInNewYork(date: Date): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${iso}T12:00:00Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
