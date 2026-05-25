import type { Context } from "hono";
import { z } from "zod";
import { readWeekPlans } from "../../services/day-plan/day-plan-service.js";

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
  const existing = await readWeekPlans(
    TEAM_ID,
    dates[0] ?? formatIsoDate(dateInNewYork(new Date())),
    dates[dates.length - 1] ?? formatIsoDate(dateInNewYork(new Date())),
  );
  const manualPlans = existing.filter(
    (plan) => plan.generatedBy === "agentic-desk-manual",
  );

  return c.json({
    ok: true,
    days,
    planned: manualPlans.map((plan) => ({
      date: plan.date,
      windowCount: plan.windows.length,
      eventName: plan.eventName,
    })),
    skippedGeneration: true,
    statusMessage:
      "Desk Plans are user-controlled; add events from the calendar or custom form.",
    failures: [],
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
