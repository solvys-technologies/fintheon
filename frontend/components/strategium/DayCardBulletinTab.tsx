// [claude-code 2026-04-26] S45-T2: DayCardBulletinTab — 5 rows Mon–Fri preview
//   inside the StickyBulletin "Day Card" tab. Each row: [DAY] [IV (Doto)]
//   [N windows] [event truncated]. Tap row scrolls Sanctum DayCard into view.
//   NO expansion, NO modal, NO inline detail. Dividers = FadingRuler. Field
//   names mirror T1 backend WeekDayEntry: day / ivScore / windowCount / eventName.
import { useDayPlanWeek } from "../../hooks/useDayPlanWeek";
import { FadingRuler } from "../shared/FadingRuler";
import { DigitGroup } from "../shared/DigitGroup";
import { ivHeatColor } from "../../types/agent-desk";

function scrollToDayCard() {
  const el = document.getElementById("day-card-anchor");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function truncate(s: string, n = 28): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export function DayCardBulletinTab() {
  const { data, isLoading } = useDayPlanWeek();
  const days = data ?? [];

  return (
    <div className="space-y-1 animate-in fade-in duration-150">
      <p
        className="text-[11px] leading-relaxed mb-1"
        style={{ color: "var(--fintheon-muted)" }}
      >
        Mon–Fri at a glance. Tap a row to jump to today's Day Card in Sanctum.
      </p>
      {isLoading && days.length === 0 ? (
        <p
          className="text-[10px] text-center py-3"
          style={{ color: "var(--fintheon-muted)" }}
        >
          Loading week…
        </p>
      ) : days.length === 0 ? (
        <p
          className="text-[10px] text-center py-3"
          style={{ color: "var(--fintheon-muted)" }}
        >
          No plan data this week.
        </p>
      ) : (
        days.map((d, i) => (
          <div key={d.date}>
            {i > 0 && <FadingRuler />}
            <button
              type="button"
              onClick={scrollToDayCard}
              className="w-full flex items-center gap-3 py-2 text-left transition-colors hover:bg-white/[0.02] rounded-md px-1.5"
              aria-label={`${d.day} ${d.eventName ?? "no event"} ${d.windowCount} windows`}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.16em] w-9 shrink-0"
                style={{
                  color: "var(--fintheon-accent)",
                  fontFamily: "var(--font-data, monospace)",
                }}
              >
                {d.day}
              </span>
              <span
                className="w-9 shrink-0 text-right"
                style={{ minWidth: 36 }}
              >
                {d.ivScore == null ? (
                  <span
                    className="text-[12px]"
                    style={{ color: "var(--fintheon-muted)" }}
                  >
                    —
                  </span>
                ) : (
                  <DigitGroup
                    value={d.ivScore.toFixed(1)}
                    style={{
                      fontFamily:
                        "'Doto', 'Readable Digits', var(--font-data, monospace)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: ivHeatColor(d.ivScore),
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.02em",
                      lineHeight: 1,
                    }}
                  />
                )}
              </span>
              <span
                className="text-[10px] font-mono shrink-0"
                style={{
                  color: "var(--fintheon-muted)",
                  width: 28,
                  textAlign: "right",
                }}
              >
                {d.windowCount}w
              </span>
              <span
                className="flex-1 text-[11px] truncate"
                style={{
                  color: "var(--fintheon-text)",
                  fontFamily: "var(--font-body)",
                }}
                title={d.eventName ?? undefined}
              >
                {truncate(d.eventName ?? "—")}
              </span>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
