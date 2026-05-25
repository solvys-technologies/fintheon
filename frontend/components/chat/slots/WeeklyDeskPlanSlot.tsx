import { useState } from "react";
import { Check, X } from "lucide-react";
import type { CustomRendererProps } from "streamdown";
import { z } from "zod";
import {
  DAY_PLAN_MULTI_REFETCH_EVENT,
  type DeskWeekPlanEvent,
} from "../../../lib/desk-week-plan";
import { DAY_PLAN_REFETCH_EVENT } from "../../../hooks/useDayPlan";
import { parseSlotBody } from "./parseSlotBody";
import { SlotError, SlotReveal, SlotShell, SlotSkeleton } from "./SlotShell";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const EventSchema = z.object({
  id: z.string(),
  day: z.string(),
  date: z.string(),
  title: z.string(),
  eventTime: z.string(),
  window: z.string(),
  forecast: z.string(),
  severity: z.number().nullable(),
});

const WeeklyDeskPlanSchema = z.object({
  events: z.array(EventSchema).min(1),
});

export function WeeklyDeskPlanSlot({
  code,
  isIncomplete,
}: CustomRendererProps) {
  const [status, setStatus] = useState<"idle" | "approving" | "approved" | "denied" | "error">("idle");
  const parsed = parseSlotBody<z.infer<typeof WeeklyDeskPlanSchema>>(
    code,
    isIncomplete,
  );
  if (parsed.status === "pending") return <SlotSkeleton label="weekly desk plan" lines={5} />;
  if (parsed.status === "error") return <SlotError label="weekly desk plan" reason={parsed.reason} />;
  const validated = WeeklyDeskPlanSchema.safeParse(parsed.data);
  if (!validated.success) return <SlotError label="weekly desk plan" reason="Schema mismatch" />;

  const approve = async () => {
    setStatus("approving");
    try {
      const response = await fetch(`${API_BASE}/api/desk/calendar/approve-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: validated.data.events.map((event) => event.id),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
      window.dispatchEvent(new Event(DAY_PLAN_MULTI_REFETCH_EVENT));
      setStatus("approved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SlotReveal>
      <SlotShell label="weekly desk plan" style={{ padding: "10px" }}>
        <WeekTable events={validated.data.events} />
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--fintheon-accent)]/10 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]/55">
            {status === "approved"
              ? "approved and synced"
              : status === "denied"
                ? "denied"
                : status === "error"
                  ? "approval failed"
                  : `${validated.data.events.length} queued events`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatus("denied")}
              disabled={status === "approving" || status === "approved"}
              className="inline-flex items-center gap-1 rounded border border-red-400/20 px-2 py-1 text-[10px] text-red-300 transition hover:bg-red-500/10 disabled:opacity-35"
            >
              <X size={11} />
              Deny
            </button>
            <button
              type="button"
              onClick={approve}
              disabled={status === "approving" || status === "approved"}
              className="inline-flex items-center gap-1 rounded bg-[var(--fintheon-accent)] px-2 py-1 text-[10px] font-semibold text-black transition hover:brightness-110 disabled:opacity-45"
            >
              <Check size={11} />
              {status === "approving" ? "Approving" : "Approve week"}
            </button>
          </div>
        </div>
      </SlotShell>
    </SlotReveal>
  );
}

function WeekTable({ events }: { events: DeskWeekPlanEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[58px_1fr_72px_108px_92px] border-b border-[var(--fintheon-accent)]/10 pb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]/55">
          <span>Day</span>
          <span>Event</span>
          <span>Time</span>
          <span>Window</span>
          <span>Forecast</span>
        </div>
        {events.map((event) => (
          <div
            key={event.id}
            className="grid grid-cols-[58px_1fr_72px_108px_92px] gap-2 border-b border-[var(--fintheon-accent)]/[0.055] py-2 text-[11px]"
          >
            <span className="font-mono text-[var(--fintheon-accent)]/75">{event.day}</span>
            <span className="min-w-0 truncate text-[var(--fintheon-text)]/82">{event.title}</span>
            <span className="font-mono text-[var(--fintheon-text)]/62">{event.eventTime}</span>
            <span className="font-mono text-[var(--fintheon-text)]/62">{event.window}</span>
            <span className="truncate font-mono text-[var(--fintheon-accent)]/70">{event.forecast}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
