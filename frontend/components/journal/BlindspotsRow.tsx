// [claude-code 2026-04-23] S30-T2: Full-width Performance-tab blindspots row.
// Before/after layout — current blindspots (left) paired with corrective actions (right).
// Backed by a stubbed hook; T3 wires a real backend source later.
import { useMemo, useState } from "react";
import { Eye, Shield, Info } from "lucide-react";

export interface BlindspotsSnapshot {
  blindspots: string[];
  corrections: string[];
  updatedAt: string;
}

const STUB_SNAPSHOT: BlindspotsSnapshot = {
  blindspots: [
    "Overtrading in low volatility",
    "Confirmation bias on bullish setups",
    "Revenge trading after losses",
    "Chasing breakouts after 10:30 ET",
  ],
  corrections: [
    "Wait for expansion regime before scaling in",
    "Cross-check thesis against at least one bearish source",
    "Hard stop + 15-min cool-down after any loss",
    "No new entries inside the 10:30-11:00 ET chop window",
  ],
  updatedAt: new Date().toISOString(),
};

/**
 * Returns the current blindspots + corrective actions.
 * Stubbed until T3 lands a backend source.
 */
export function useBlindspots(): BlindspotsSnapshot {
  return STUB_SNAPSHOT;
}

interface BlindspotsRowProps {
  /** Optional override — handy for testing / Storybook. */
  snapshot?: BlindspotsSnapshot;
}

export function BlindspotsRow({ snapshot }: BlindspotsRowProps) {
  const data = useBlindspots();
  const view = snapshot ?? data;
  const pairs = useMemo(() => {
    const count = Math.max(view.blindspots.length, view.corrections.length);
    return Array.from({ length: count }, (_, i) => ({
      blindspot: view.blindspots[i] ?? "",
      correction: view.corrections[i] ?? "",
    }));
  }, [view]);

  return (
    <section className="w-full">
      <TitleRow updatedAt={view.updatedAt} />
      <div className="grid grid-cols-2 gap-3">
        <Column
          variant="before"
          icon={<Eye className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />}
          heading="Current Blindspots"
          items={pairs.map((p) => p.blindspot)}
          emptyMessage="No active blindspots detected."
        />
        <Column
          variant="after"
          icon={
            <Shield className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          }
          heading="Corrective Actions"
          items={pairs.map((p) => p.correction)}
          emptyMessage="No corrections logged yet."
        />
      </div>
    </section>
  );
}

function TitleRow({ updatedAt }: { updatedAt: string }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const updatedLabel = useMemo(() => {
    try {
      return new Date(updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  }, [updatedAt]);

  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-[var(--fintheon-text)]">
          Blindspots · Before / After
        </h3>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onBlur={() => setTooltipOpen(false)}
            aria-label="About blindspots before/after"
            className="p-0.5 text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)] transition-colors"
          >
            <Info className="w-3 h-3" />
          </button>
          {tooltipOpen && (
            <div
              role="tooltip"
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-[240px] p-2 rounded border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-bg)] text-[10px] leading-snug text-[var(--fintheon-text)] z-20"
            >
              Left column is what's been costing you this week. Right column is
              the paired corrective action the desk wants logged before next
              session. Rows align one-to-one.
            </div>
          )}
        </div>
      </div>
      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--fintheon-muted)]">
        Updated {updatedLabel}
      </span>
    </div>
  );
}

function Column({
  variant,
  icon,
  heading,
  items,
  emptyMessage,
}: {
  variant: "before" | "after";
  icon: React.ReactNode;
  heading: string;
  items: string[];
  emptyMessage: string;
}) {
  const nonEmpty = items.filter(Boolean);
  const accentLabel = variant === "before" ? "Before" : "After";
  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded-lg p-3">
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[10px] font-semibold text-[var(--fintheon-text)]">
            {heading}
          </span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--fintheon-accent)]/70">
          {accentLabel}
        </span>
      </header>
      {nonEmpty.length === 0 ? (
        <p className="text-[10px] text-[var(--fintheon-muted)] italic">
          {emptyMessage}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-[3px] w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)]/70 flex-shrink-0" />
              <span className="text-[10px] leading-snug text-[var(--fintheon-text)]">
                {text || (
                  <em className="text-[var(--fintheon-muted)]">
                    Pending counterpart.
                  </em>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
