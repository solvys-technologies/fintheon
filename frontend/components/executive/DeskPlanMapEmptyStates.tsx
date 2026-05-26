import { CalendarDays } from "lucide-react";
import { nextFiveDays, formatDate } from "./DeskPlanMapUtils";

const EMPTY_POP_OUT =
  "rounded border border-dashed border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/[0.45] transition-[transform,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[var(--fintheon-accent)]/[0.18] hover:bg-[var(--fintheon-accent)]/[0.025] active:translate-y-0";

export function EmptyTimeline() {
  const slots = [
    ["Pre-market", "07:00 - 09:30"],
    ["Open", "09:30 - 11:00"],
    ["Midday", "11:00 - 14:00"],
    ["Close", "14:00 - 16:00"],
  ];
  return (
    <div className="space-y-3">
      {slots.map(([slot, time], index) => (
        <div key={slot} className="grid grid-cols-[92px_1fr] gap-4">
          <div className="text-right">
            <div className="font-mono text-[10px] text-[var(--fintheon-accent)]/60">
              {slot}
            </div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/30">
              Slot {index + 1}
            </div>
          </div>
          <div className="min-h-[48px] pl-4">
            <div
              className={`${EMPTY_POP_OUT} flex items-center justify-between gap-3 px-3 py-2`}
            >
              <span className="font-mono text-[9px] text-[var(--fintheon-muted)]/45">
                {time} ET
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/35">
                [UNPLANNED]
              </span>
            </div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-[var(--fintheon-muted)]/45">
        No Desk Plans scheduled. Add one from TradingView or the Desk Plan add
        control.
      </p>
    </div>
  );
}

export function EmptyCalendar() {
  return (
    <div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        {nextFiveDays().map((date) => (
          <section key={date} className={`${EMPTY_POP_OUT} min-h-[150px] p-3`}>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3 w-3 text-[var(--fintheon-accent)]/35" />
              <h3 className="font-mono text-[10px] text-[var(--fintheon-accent)]/55">
                {formatDate(date)}
              </h3>
            </div>
            <div className="mt-5 border-t border-[var(--fintheon-accent)]/10 pt-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/35">
                [NO PLAN]
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--fintheon-muted)]/45">
                Open calendar slot.
              </p>
            </div>
          </section>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[var(--fintheon-muted)]/45">
        Calendar is blank until a Desk Plan is scheduled.
      </p>
    </div>
  );
}
