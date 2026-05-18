// [claude-code 2026-05-15] Econ forecast: replaced price rows with econ forecast rows.
//   Forecast, Miss (with chevron + probability), Beat (with chevron + probability),
//   Other Notable Events, and AI Prediction. Speeches show hawkish/dovish/none.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { DayPlan, DayPlanWindow, EconForecastScenario } from "../../types/day-plan";
import { formatEasternClockRange } from "../../lib/eastern-time-format";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

type BriefType = "MDB" | "ADB" | "PMDB";

function pickBriefType(): BriefType {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(fmt.find((p) => p.type === "hour")?.value ?? "0");
  if (hour < 11) return "MDB";
  if (hour < 16) return "ADB";
  return "PMDB";
}

function fmtTradingWindow(w: DayPlanWindow): string {
  return formatEasternClockRange(w.startTime, w.endTime);
}

type ScenarioTone = "neutral" | "bullish" | "bearish";

// ---- inline Doto numeral span ----

function DotoNum({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: ScenarioTone;
}) {
  const color =
    tone === "bullish"
      ? "var(--fintheon-bullish)"
      : tone === "bearish"
        ? "var(--fintheon-bearish)"
        : "var(--fintheon-text)";

  return (
    <span
      className="tabular-nums"
      style={{
        color,
        fontFamily: "'Doto', 'Readable Digits', var(--font-data, monospace)",
        letterSpacing: "0.04em",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function ChevronIcon({ bullish }: { bullish: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      style={{
        color: bullish
          ? "var(--fintheon-bullish)"
          : "var(--fintheon-bearish)",
        transform: bullish ? "rotate(0deg)" : "rotate(180deg)",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <path
        d="M3 6L5 3L7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DataRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: ScenarioTone;
}) {
  const color =
    tone === "bullish"
      ? "var(--fintheon-bullish)"
      : tone === "bearish"
        ? "var(--fintheon-bearish)"
        : "var(--fintheon-text)";

  return (
    <div className="flex items-baseline gap-2">
      <dt
        className="text-[10px] shrink-0"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </dt>
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: 0,
          borderBottom:
            "1px dotted color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
          transform: "translateY(-3px)",
        }}
      />
      <dd
        className="tabular-nums text-right shrink-0"
        style={{
          color,
          fontFamily: "var(--font-data, monospace)",
          letterSpacing: "0.01em",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function ScenarioRow({
  label,
  scenario,
}: {
  label: string;
  scenario: EconForecastScenario;
}) {
  const tone: ScenarioTone = scenario.isBullishForEquities ? "bullish" : "bearish";
  const color =
    tone === "bullish"
      ? "var(--fintheon-bullish)"
      : "var(--fintheon-bearish)";

  return (
    <div className="flex items-baseline gap-2">
      <dt
        className="text-[10px] shrink-0"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </dt>
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: 0,
          borderBottom:
            "1px dotted color-mix(in srgb, var(--fintheon-accent) 14%, transparent)",
          transform: "translateY(-3px)",
        }}
      />
      <dd
        className="tabular-nums text-right shrink-0 inline-flex items-center gap-1"
        style={{ color, fontFamily: "var(--font-data, monospace)", letterSpacing: "0.01em" }}
      >
        <ChevronIcon bullish={tone === "bullish"} />
        <span className="text-[11px]">
          {scenario.description} ({scenario.probability}%)
        </span>
      </dd>
    </div>
  );
}

// ---- main widget ----

export function DeskThemeWidget() {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  const briefType = pickBriefType();

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/day-plan/today`);
      if (!res.ok) {
        setPlan(null);
        return;
      }
      const json = (await res.json()) as { plan: DayPlan | null };
      setPlan(json.plan ?? null);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlan();
    const id = window.setInterval(fetchPlan, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [fetchPlan]);

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const themeText = plan?.deskTheme ?? null;
  const eventName = plan?.eventName ?? null;
  const dayWindow = plan?.windows?.[0] ?? null;
  const hasWindow = !!dayWindow;
  const forecast = dayWindow?.econForecast ?? null;

  return (
    <div
      style={{
        background: "transparent",
        padding: 12,
        height: open ? "100%" : undefined,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
            Desk Plan
          </h3>
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">
            {briefType}
          </span>
        </div>
        {(plan || loading) && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-[var(--fintheon-accent)] inline-flex items-center gap-1 shrink-0"
          >
            {open ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {open ? "Collapse" : "Read"}
          </button>
        )}
      </div>

      {/* compact body */}
      {!open && (
        <div className="mt-2 text-[12px] leading-snug text-[var(--fintheon-text)] min-h-[24px]">
          {loading ? (
            <span className="text-zinc-600 text-[11px]">Loading…</span>
          ) : themeText ? (
            <div>
              {eventName && (
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
                  {eventName} &middot;
                </span>
              )}
              <span>{themeText}</span>

              {hasWindow && (
                <div className="mt-2.5 space-y-1 text-[11px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="shrink-0"
                      style={{
                        color: "var(--fintheon-muted, #908774)",
                        fontFamily: "var(--font-body)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Event
                    </span>
                    <span
                      className="tabular-nums text-right"
                      style={{
                        color: "var(--fintheon-text)",
                        fontFamily: "var(--font-data, monospace)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {eventName ?? "\u2014"}
                    </span>
                  </div>
                  <div
                    className="text-[var(--fintheon-muted,#908774)]"
                    style={{
                      fontFamily: "var(--font-body)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {fmtTradingWindow(dayWindow)} ET
                  </div>
                  {forecast && (
                    <>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="shrink-0"
                          style={{
                            color: "var(--fintheon-muted, #908774)",
                            fontFamily: "var(--font-body)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Forecast
                        </span>
                        <DotoNum>{forecast.forecast}</DotoNum>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="shrink-0"
                          style={{
                            color: "var(--fintheon-muted, #908774)",
                            fontFamily: "var(--font-body)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Miss
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          style={{
                            fontFamily: "var(--font-data, monospace)",
                            color: forecast.miss.isBullishForEquities
                              ? "var(--fintheon-bullish)"
                              : "var(--fintheon-bearish)",
                            fontSize: 10,
                          }}
                        >
                          <ChevronIcon bullish={forecast.miss.isBullishForEquities} />
                          {forecast.miss.description}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="shrink-0"
                          style={{
                            color: "var(--fintheon-muted, #908774)",
                            fontFamily: "var(--font-body)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Beat
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          style={{
                            fontFamily: "var(--font-data, monospace)",
                            color: forecast.beat.isBullishForEquities
                              ? "var(--fintheon-bullish)"
                              : "var(--fintheon-bearish)",
                            fontSize: 10,
                          }}
                        >
                          <ChevronIcon bullish={forecast.beat.isBullishForEquities} />
                          {forecast.beat.description}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-600 text-[11px]">
              No desk plan published yet.
              <span className="block text-[9px] mt-0.5 text-zinc-700">
                Desk plans publish at 06:30 ET.
              </span>
            </span>
          )}
        </div>
      )}

      {/* expanded body (Read open) */}
      {open && (
        <div
          className="t-panel-slide flex-1 flex flex-col min-h-0"
          data-open={revealed ? "true" : "false"}
          style={{ marginTop: 8 }}
        >
          <div className="text-[12px] leading-snug text-[var(--fintheon-text)] mb-3">
            {loading ? (
              <span className="text-zinc-600 text-[11px]">Loading…</span>
            ) : themeText ? (
              themeText
            ) : (
              <span className="text-zinc-600 text-[11px]">
                No desk plan published yet.
              </span>
            )}
          </div>

          {hasWindow && (
            <dl className="font-mono text-[11px] space-y-1.5">
              <DataRow label="Event" value={eventName ?? "\u2014"} />
              <DataRow
                label="Trading Window"
                value={fmtTradingWindow(dayWindow)}
              />
              {forecast && (
                <>
                  <DataRow label="Forecast" value={forecast.forecast} />
                  <ScenarioRow label="Miss" scenario={forecast.miss} />
                  <ScenarioRow label="Beat" scenario={forecast.beat} />
                  {forecast.otherNotableEvents.length > 0 && (
                    <DataRow
                      label="Notable"
                      value={forecast.otherNotableEvents.join(", ")}
                    />
                  )}
                  <DataRow
                    label="AI Prediction"
                    value={forecast.aiPrediction}
                  />
                </>
              )}
              {!forecast && (
                <DataRow label="Forecast" value="Awaiting data..." />
              )}
            </dl>
          )}

          {!hasWindow && !loading && plan && (
            <p
              className="text-[11px] mt-2"
              style={{ color: "var(--fintheon-muted, #908774)" }}
            >
              No trading window set for today.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
