// [claude-code 2026-04-29] S49: Rewrote DeskThemeWidget with compact price
//   block + read-expansion to full DayCard layout. Dropped brief body fetch
//   and <pre> mirror. Color binding via --fintheon-bullish / --fintheon-bearish
//   CSS vars. Expansion uses t-panel-slide + rAF reveal.
// [claude-code 2026-04-27] S46.4/G: DeskTheme widget for the Strategium
// pane. Pulls the latest desk theme from /api/day-plan/today (which is
// populated by the same generator that writes the desk_theme block into
// MDB / ADB / PMDB briefs). Tap-to-expand -> in-place full reader.
//
// Visual: flat solvys-feels surface — translucent bg + thin accent border,
// no Kanban frames, no gradients, no AI sparkles, no backdrop-blur ornament.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";

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

// ---- shared price formatters (same shape as DayCard) ----

function fmtPrice(v: number | null): string {
  if (v == null) return "\u2014";
  return v.toFixed(2);
}

function fmtPrices(values: number[]): string {
  return values.map((v) => v.toFixed(2)).join(", ");
}

function fmtTradingWindow(w: DayPlanWindow): string {
  return `${w.startTime}-${w.endTime}`;
}

function fmtExpectedMove(pct: number | null): string {
  if (pct == null) return "\u2014";
  return `\u00b1 ${pct.toFixed(2)}%`;
}

// ---- inline Doto numeral span ----

function DotoNum({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "bullish" | "bearish";
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

// ---- expanded data row (mirrors DayCard Row shape) ----

function DataRow({
  label,
  value,
  doto,
  tone = "neutral",
}: {
  label: string;
  value: string;
  doto?: boolean;
  tone?: "neutral" | "bullish" | "bearish";
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
          fontFamily: doto
            ? "'Doto', 'Readable Digits', var(--font-data, monospace)"
            : "var(--font-data, monospace)",
          letterSpacing: doto ? "0.04em" : "0.01em",
          fontWeight: doto ? 600 : 400,
        }}
      >
        {value}
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

  // rAF reveal so t-panel-slide runs on entry.
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
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="shrink-0"
                      style={{
                        color: "var(--fintheon-muted, #908774)",
                        fontFamily: "var(--font-body)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Entry
                    </span>
                    <DotoNum>
                      {dayWindow.pricesOfInterest.length > 0
                        ? fmtPrices(dayWindow.pricesOfInterest)
                        : "\u2014"}
                    </DotoNum>
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
                      Invalid
                    </span>
                    <DotoNum tone="bearish">
                      {fmtPrice(dayWindow.invalidation)}
                    </DotoNum>
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
                      Target
                    </span>
                    <DotoNum tone="bullish">
                      {fmtPrice(dayWindow.profitTarget)}
                    </DotoNum>
                  </div>
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
              <DataRow
                label="Prices of Interest"
                value={
                  dayWindow.pricesOfInterest.length > 0
                    ? fmtPrices(dayWindow.pricesOfInterest)
                    : "\u2014"
                }
                doto
                tone="neutral"
              />
              <DataRow
                label="Invalidation Point"
                value={fmtPrice(dayWindow.invalidation)}
                doto
                tone="bearish"
              />
              <DataRow
                label="Profit Target"
                value={fmtPrice(dayWindow.profitTarget)}
                doto
                tone="bullish"
              />
              <DataRow
                label="Expected Move"
                value={fmtExpectedMove(dayWindow.expectedMovePct)}
                doto
                tone="neutral"
              />
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
