import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { formatEasternClockRange } from "../../lib/eastern-time-format";
import { cn } from "../../lib/utils";
import type { DayPlan, DayPlanWindow } from "../../types/day-plan";
import { FadingRuler } from "../shared/FadingRuler";

type ScenarioTone = "neutral" | "bullish" | "bearish";

export function DeskPlanInlineWidget({
  plan,
  window,
  isOpen,
  compact = false,
}: {
  plan: DayPlan;
  window: DayPlanWindow;
  isOpen: boolean;
  compact?: boolean;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }
    const timer = window.setTimeout(() => setShouldRender(false), 190);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!shouldRender) return null;

  const forecast = window.econForecast;
  const missTone = scenarioTone(forecast?.miss.isBullishForEquities);
  const beatTone = scenarioTone(forecast?.beat.isBullishForEquities);
  const thesis =
    forecast?.aiPrediction ??
    plan.deskTheme ??
    "Awaiting agentic desk forecast.";

  return (
    <div
      className={cn(
        "desk-plan-inline-widget",
        isOpen ? "is-open" : "is-closing",
        compact ? "text-[10px]" : "text-[10.5px]",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <FadingRuler className="mb-2 opacity-40" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 text-[var(--fintheon-accent)]/68" />
          <span className="font-mono uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/72">
            Desk Plan
          </span>
        </div>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/48">
          {formatPlanDate(plan.date)}
        </span>
      </div>
      <dl className="mt-2 space-y-1.5 font-mono">
        <InlineRow
          label="Event"
          value={window.eventName ?? plan.eventName ?? "Desk session"}
        />
        <InlineRow
          label="Trading Window"
          value={formatEasternClockRange(window.startTime, window.endTime)}
        />
        <InlineRow label="Forecast" value={forecast?.forecast ?? "pending"} />
        <InlineRow
          label="Miss"
          value={
            forecast
              ? scenarioPrint(
                  forecast.forecast,
                  forecast.miss.agenticPrint,
                  "miss",
                )
              : "\u2014"
          }
          tone={missTone}
        />
        <InlineRow
          label="Beat"
          value={
            forecast
              ? scenarioPrint(
                  forecast.forecast,
                  forecast.beat.agenticPrint,
                  "beat",
                )
              : "\u2014"
          }
          tone={beatTone}
        />
      </dl>
      <p className="mt-2 line-clamp-4 text-[10px] leading-relaxed text-[var(--fintheon-text)]/58">
        {thesis}
      </p>
    </div>
  );
}

function InlineRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: ScenarioTone;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[var(--fintheon-muted)]/58">{label}</dt>
      <span
        aria-hidden
        className="h-px flex-1 translate-y-[-3px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, color-mix(in srgb, var(--fintheon-accent) 14%, transparent) 0 2px, transparent 2px 7px)",
          maskImage:
            "linear-gradient(to right, #000 0%, #000 34%, transparent 50%, #000 66%, #000 100%)",
        }}
      />
      <dd
        className="max-w-[58%] truncate text-right tabular-nums"
        style={{ color: toneColor(tone) }}
      >
        {value}
      </dd>
    </div>
  );
}

function scenarioTone(isBullish: boolean | undefined): ScenarioTone {
  if (isBullish == null) return "neutral";
  return isBullish ? "bullish" : "bearish";
}

function toneColor(tone: ScenarioTone) {
  if (tone === "bullish") return "var(--fintheon-bullish)";
  if (tone === "bearish") return "var(--fintheon-bearish)";
  return "var(--fintheon-text)";
}

function scenarioPrint(
  forecast: string,
  explicitValue: string | undefined,
  side: "miss" | "beat",
) {
  const explicit = explicitValue?.trim();
  if (explicit) return explicit;
  const clean = forecast.trim();
  if (!clean || /^(n\/?a|null|undefined)$/i.test(clean)) return "\u2014";
  const lower = clean.toLowerCase();
  if (lower === "hawkish" || lower === "dovish" || lower === "none") {
    if (side === "miss") return lower === "hawkish" ? "dovish" : lower;
    return lower === "dovish" ? "hawkish" : lower;
  }
  if (/^[<>≤≥]/.test(clean)) return clean;
  return `${side === "miss" ? "<" : ">"}${clean}`;
}

function formatPlanDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
