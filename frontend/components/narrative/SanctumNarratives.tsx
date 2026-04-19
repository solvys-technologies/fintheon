// [claude-code 2026-04-19] S25-T5: Removed kanban-style card borders in favor of fading row separators; added Crowding (0-10) axis with hover lexicon explaining the score; kept health + instruments + status.
// [claude-code 2026-03-28] S8-T4: Removed Simulation History — replaced by Agent Scorecards in Page 2
// [claude-code 2026-03-23] Active Narratives — Page 2
import { useState } from "react";
import { Diff, TrendingDown, Minus, Info } from "lucide-react";
import type { SanctumNarrative } from "../../types/agent-desk";

interface SanctumNarrativesProps {
  narratives?: SanctumNarrative[];
  expanded?: boolean;
  onNavigateToNarrative?: (narrativeId: string) => void;
}

const CROWDING_LEXICON = [
  {
    band: "0–3",
    label: "Contrarian",
    meaning: "Thin positioning; asymmetric payoff, but catalyst fragile.",
  },
  {
    band: "4–6",
    label: "Forming",
    meaning: "Consensus building; trend alive, fade risk still manageable.",
  },
  {
    band: "7–8",
    label: "Crowded",
    meaning: "Heavy positioning; stops dense, news-sensitive reversals.",
  },
  {
    band: "9–10",
    label: "Washout-prone",
    meaning: "Peak crowding; every surprise rings the unwind bell.",
  },
];

function directionIcon(bias: string) {
  if (bias === "bullish")
    return <Diff className="w-3.5 h-3.5 text-[var(--fintheon-low)]" />;
  if (bias === "bearish")
    return (
      <TrendingDown className="w-3.5 h-3.5 text-[var(--fintheon-severe)]" />
    );
  return (
    <Minus className="w-3.5 h-3.5 text-[var(--fintheon-neutral-severe)]" />
  );
}

function healthColor(score: number): string {
  if (score >= 70) return "var(--fintheon-low)";
  if (score >= 40) return "var(--fintheon-neutral-severe)";
  return "var(--fintheon-severe)";
}

function crowdingColor(score: number): string {
  if (score >= 9) return "var(--fintheon-severe)";
  if (score >= 7) return "var(--fintheon-neutral-severe)";
  if (score >= 4) return "var(--fintheon-accent)";
  return "var(--fintheon-low)";
}

/**
 * Placeholder crowding derivation until the backend surfaces a real score:
 * high health + high instrument count roughly correlates with crowded trades.
 */
function deriveCrowding(n: SanctumNarrative): number {
  const instrumentWeight = Math.min(5, n.instruments.length) * 1.2;
  const healthWeight = (n.healthScore / 100) * 5;
  return Math.max(0, Math.min(10, instrumentWeight + healthWeight));
}

function NarrativeRow({
  narrative,
  onNavigate,
  isLast,
}: {
  narrative: SanctumNarrative;
  onNavigate?: (id: string) => void;
  isLast: boolean;
}) {
  const crowding = deriveCrowding(narrative);
  const cColor = crowdingColor(crowding);

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(narrative.id)}
      title="View on Observatory map"
      className={`w-full grid grid-cols-[20px_1fr_auto_100px_100px] gap-3 items-center px-3 py-2 text-left transition-colors hover:bg-[var(--fintheon-accent)]/5 ${
        isLast ? "" : "border-b border-[var(--fintheon-border)]/6"
      }`}
    >
      <span className="shrink-0">{directionIcon(narrative.directionBias)}</span>
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-[var(--fintheon-text)] truncate">
            {narrative.title}
          </span>
          <span className="text-[8px] font-mono text-[var(--fintheon-muted)]/55 uppercase tracking-wider">
            {narrative.category}
          </span>
        </div>
        {narrative.instruments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {narrative.instruments.slice(0, 5).map((inst) => (
              <span
                key={inst}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-accent)]/70"
              >
                {inst}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status + date */}
      <div className="flex flex-col items-end text-[8px] font-mono text-[var(--fintheon-muted)]/40 shrink-0">
        <span className="uppercase tracking-wider">{narrative.status}</span>
        <span>{narrative.dateRange.start.slice(5)}</span>
      </div>

      {/* Health fuse */}
      <Fuse
        label="HEALTH"
        value={narrative.healthScore}
        maxValue={100}
        color={healthColor(narrative.healthScore)}
      />

      {/* Crowding fuse */}
      <Fuse
        label="CROWD"
        value={crowding}
        maxValue={10}
        color={cColor}
        decimals={1}
      />
    </button>
  );
}

function Fuse({
  label,
  value,
  maxValue,
  color,
  decimals = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  decimals?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[7px] tracking-[0.22em] uppercase text-[var(--fintheon-muted)]/50"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-bold"
          style={{
            color,
            fontFamily: "Doto, ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {value.toFixed(decimals)}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--fintheon-border)]/12 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function SanctumNarratives({
  narratives,
  onNavigateToNarrative,
}: SanctumNarrativesProps) {
  const [lexiconOpen, setLexiconOpen] = useState(false);
  const hasNarratives = narratives && narratives.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span
          className="text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/85"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Active Narratives
        </span>
        <button
          type="button"
          onClick={() => setLexiconOpen((v) => !v)}
          className="flex items-center gap-1 text-[9px] tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/55 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Crowding scale reference"
        >
          <Info size={10} />
          Lexicon
        </button>
      </div>

      {/* Lexicon drawer */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300"
        style={{
          maxHeight: lexiconOpen ? "220px" : "0px",
          opacity: lexiconOpen ? 1 : 0,
        }}
      >
        <div className="px-3 pb-2 flex flex-col gap-1">
          {CROWDING_LEXICON.map((e) => (
            <div key={e.band} className="grid grid-cols-[46px_80px_1fr] gap-2">
              <span
                className="text-[10px] font-bold"
                style={{
                  color: "var(--fintheon-accent)",
                  fontFamily: "Doto, ui-monospace, monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {e.band}
              </span>
              <span className="text-[9px] tracking-[0.16em] uppercase text-[var(--fintheon-muted)]/70">
                {e.label}
              </span>
              <span className="text-[9px] text-[var(--fintheon-muted)]/55 leading-relaxed">
                {e.meaning}
              </span>
            </div>
          ))}
        </div>
      </div>

      {hasNarratives ? (
        <div className="flex flex-col">
          {narratives!.map((n, idx) => (
            <NarrativeRow
              key={n.id}
              narrative={n}
              onNavigate={onNavigateToNarrative}
              isLast={idx === narratives!.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-6 text-center">
          <p className="text-[10px] text-[var(--fintheon-muted)]/30">
            Connect Narrative Flow to track active market narratives
          </p>
          <p className="text-[9px] text-[var(--fintheon-muted)]/20 mt-1">
            Create lanes in the Narratives tab to populate this view
          </p>
        </div>
      )}
    </div>
  );
}
