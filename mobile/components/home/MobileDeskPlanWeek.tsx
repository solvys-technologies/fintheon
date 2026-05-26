import { useEffect, useMemo, useState } from "react";
import type { DayPlan } from "../../types/day-plan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function shortWindow(plan: DayPlan): string {
  const first = plan.windows?.[0];
  if (!first) return "No window";
  const suffix = plan.windows.length > 1 ? ` +${plan.windows.length - 1}` : "";
  return `${first.startTime}-${first.endTime}${suffix}`;
}

export function MobileDeskPlanWeek() {
  const [weeks, setWeeks] = useState<DayPlan[][]>([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/day-plan/multi-week`);
        if (!res.ok) return;
        const data = (await res.json()) as { weeks?: DayPlan[][] };
        if (!cancelled) setWeeks(data.weeks ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const currentWeek = weeks[weekIndex] ?? [];
  const days = useMemo(() => {
    const byDay = new Map<string, DayPlan[]>();
    for (const plan of currentWeek) {
      const key = new Date(`${plan.date}T12:00:00`).toLocaleDateString([], {
        weekday: "short",
      });
      byDay.set(key, [...(byDay.get(key) ?? []), plan]);
    }
    return WEEK_DAYS.map((day) => ({ day, plans: byDay.get(day) ?? [] }));
  }, [currentWeek]);

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        padding: "18px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 10px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          Desk Plans
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
            disabled={weekIndex === 0}
            style={navButtonStyle}
          >
            Prev
          </button>
          <span style={weekCounterStyle}>
            {weeks.length ? `${weekIndex + 1}/${weeks.length}` : "--"}
          </span>
          <button
            type="button"
            onClick={() =>
              setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))
            }
            disabled={weekIndex >= weeks.length - 1}
            style={navButtonStyle}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>[LOADING DESK PLANS...]</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
            gap: 8,
            overflowX: "auto",
            padding: "0 16px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {days.map(({ day, plans }) => (
            <div key={day} style={dayColumnStyle}>
              <div style={dayHeaderStyle}>
                {plans[0] ? formatDay(plans[0].date) : day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plans.length === 0 ? (
                  <div style={openStyle}>[OPEN]</div>
                ) : (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() =>
                        setOpenId((id) => (id === plan.id ? null : plan.id))
                      }
                      style={planButtonStyle}
                    >
                      <span style={planTitleStyle}>
                        {plan.eventName ?? plan.deskTheme ?? "Desk session"}
                      </span>
                      <span style={planMetaStyle}>{shortWindow(plan)}</span>
                      {openId === plan.id && (
                        <span style={planForecastStyle}>
                          {plan.windows?.[0]?.econForecast?.aiPrediction ??
                            "Forecast pending."}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const navButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid color-mix(in srgb, var(--accent) 16%, transparent)",
  color: "var(--text-secondary)",
  borderRadius: 6,
  padding: "5px 8px",
  fontFamily: "var(--font-data)",
  fontSize: 10,
};

const weekCounterStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  color: "var(--text-disabled)",
  minWidth: 28,
  textAlign: "center",
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  fontFamily: "var(--font-data)",
  fontSize: 11,
  color: "var(--text-disabled)",
};

const dayColumnStyle: React.CSSProperties = {
  minHeight: "100%",
  borderTop: "1px solid var(--border)",
  paddingTop: 10,
};

const dayHeaderStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 10,
};

const openStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  color: "var(--text-disabled)",
};

const planButtonStyle: React.CSSProperties = {
  textAlign: "left",
  background: "color-mix(in srgb, var(--accent) 4%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
  borderRadius: 8,
  padding: 10,
  color: "var(--text-primary)",
};

const planTitleStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  lineHeight: 1.35,
};

const planMetaStyle: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  fontFamily: "var(--font-data)",
  fontSize: 9,
  color: "var(--accent)",
};

const planForecastStyle: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  fontFamily: "var(--font-body)",
  fontSize: 11,
  lineHeight: 1.45,
  color: "var(--text-secondary)",
};
