// [claude-code 2026-04-19] S25-T4a: Chevron event card for Econ Intelligence — CAO description (placeholder until 4b), third-order thinking, conditional forecast (only on beat/miss), per-print rows (Date | Variant | Previous | Forecast | Actual | Deviation priority-colored), AI-synthesis confidence Nothing-Design fuse footer. Magical fade-in via parent-supplied delay.
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { EconHistoryPrint } from "../../../types/miroshark";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface EconEventCardData {
  ticker: string;
  name: string;
  category: "supply-chain" | "employment" | "price-stability" | "general";
  releasesCollected: number;
  lastSeen: string | null;
  nextRelease: string | null;
}

interface EconEventCardProps {
  event: EconEventCardData;
  /** ms delay applied to the appear animation so cards render in stagger */
  appearDelay: number;
}

const CATEGORY_LABEL: Record<EconEventCardData["category"], string> = {
  "supply-chain": "Supply Chain",
  employment: "Employment",
  "price-stability": "Price Stability",
  general: "General",
};

const CATEGORY_ACCENT: Record<EconEventCardData["category"], string> = {
  "supply-chain": "var(--fintheon-accent)",
  employment: "#67e8f9",
  "price-stability": "#34D399",
  general: "var(--fintheon-muted)",
};

interface SynthesisPayload {
  description: string;
  thirdOrder: string;
  forecast: {
    direction: "beat" | "miss" | "inline" | null;
    deviation: number | null;
  } | null;
  confidence: number;
  prints: Array<EconHistoryPrint & { variant?: string | null }>;
}

export function EconEventCard({ event, appearDelay }: EconEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [synthesis, setSynthesis] = useState<SynthesisPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Stagger appear effect — fade-up
  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), appearDelay);
    return () => clearTimeout(t);
  }, [appearDelay]);

  // Lazy synthesis fetch on first expand — real CAO synthesis via POST /api/econ/synthesize,
  // fallback to history-only heuristic derivation if the endpoint fails.
  useEffect(() => {
    if (!expanded || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    const fallbackFromHistory = async () => {
      const r = await fetch(
        `${API_BASE}/api/data/econ-history/${encodeURIComponent(event.ticker)}?limit=10`,
      );
      if (!r.ok) return null;
      const data = await r.json();
      const prints = (data.history ?? []) as EconHistoryPrint[];
      const latest = prints[0];
      const beatMissConcluded =
        latest?.direction === "beat" || latest?.direction === "miss";
      return {
        description: deriveDescription(event, prints),
        thirdOrder: deriveThirdOrder(event, prints),
        forecast: beatMissConcluded
          ? { direction: latest.direction, deviation: latest.surprise }
          : null,
        confidence: deriveConfidence(prints),
        prints,
      } as SynthesisPayload;
    };

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/econ/synthesize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: [event.ticker] }),
        });
        if (!r.ok) throw new Error(`synthesize ${r.status}`);
        const data = await r.json();
        const evt = (data.events ?? [])[0];
        if (!evt || !evt.description) throw new Error("empty_synthesis");
        setSynthesis({
          description: evt.description,
          thirdOrder: evt.thirdOrder ?? "",
          forecast: evt.forecast ?? null,
          confidence: evt.confidence ?? 0.5,
          prints: evt.prints ?? [],
        });
      } catch {
        const fallback = await fallbackFromHistory().catch(() => null);
        if (fallback) setSynthesis(fallback);
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded, event]);

  const accent = CATEGORY_ACCENT[event.category];

  return (
    <div
      className="w-full transition-all duration-500 ease-out"
      style={{
        opacity: appeared ? 1 : 0,
        transform: appeared ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left group transition-colors hover:bg-[var(--fintheon-accent)]/4"
      >
        {/* Chevron */}
        <ChevronDown
          size={14}
          className="shrink-0 transition-transform duration-300 text-[var(--fintheon-muted)]/50 group-hover:text-[var(--fintheon-accent)]"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />

        {/* Ticker + name */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] font-bold"
              style={{
                color: "var(--fintheon-accent)",
                fontFamily: "Doto, ui-monospace, monospace",
                letterSpacing: "0.02em",
              }}
            >
              {event.ticker}
            </span>
            <span
              className="text-[8px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded"
              style={{
                color: accent,
                backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
              }}
            >
              {CATEGORY_LABEL[event.category]}
            </span>
          </div>
          <span className="text-[10px] text-[var(--fintheon-muted)]/55 truncate">
            {event.name}
          </span>
        </div>

        {/* Sub-desc: how many releases collected · how long ago · next release */}
        <div className="hidden sm:flex flex-col items-end shrink-0">
          <span className="text-[9px] text-[var(--fintheon-muted)]/45">
            {event.releasesCollected} prints
            {event.lastSeen ? ` · last ${formatAgo(event.lastSeen)}` : ""}
          </span>
          {event.nextRelease && (
            <span className="text-[9px] text-[var(--fintheon-muted)]/40">
              next {event.nextRelease}
            </span>
          )}
        </div>
      </button>

      {/* Expanded body */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out"
        style={{
          maxHeight: expanded ? "1200px" : "0px",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
          {/* Top fading horizontal ruler */}
          <FadingHRule />

          {loading && (
            <p className="text-[10px] text-[var(--fintheon-muted)]/40">
              Synthesizing…
            </p>
          )}

          {synthesis && (
            <>
              {/* CAO description + third-order thinking */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles
                    size={11}
                    className="text-[var(--fintheon-accent)]"
                  />
                  <span
                    className="text-[9px] tracking-[0.2em] uppercase text-[var(--fintheon-accent)]/80"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    CAO Synthesis
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--fintheon-text)]/75">
                  {synthesis.description}
                </p>
                <p className="text-[10px] leading-relaxed text-[var(--fintheon-muted)]/65 italic">
                  Third-order: {synthesis.thirdOrder}
                </p>

                {/* Conditional forecast — only when beat/miss conclusive */}
                {synthesis.forecast?.direction &&
                  synthesis.forecast.direction !== "inline" && (
                    <ForecastChip
                      direction={synthesis.forecast.direction}
                      deviation={synthesis.forecast.deviation}
                    />
                  )}
              </div>

              <FadingHRule />

              {/* Print rows: Date | Variant | [→] Previous | Forecast | Actual | Deviation */}
              <div className="flex flex-col">
                <div className="grid grid-cols-[68px_1fr_56px_56px_56px_64px] gap-2 text-[8px] tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/40 px-1 pb-1.5 border-b border-[var(--fintheon-border)]/8">
                  <span>Date</span>
                  <span>Variant</span>
                  <span className="text-right">Previous</span>
                  <span className="text-right">Forecast</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Deviation</span>
                </div>
                {synthesis.prints.length === 0 && (
                  <p className="text-[10px] text-[var(--fintheon-muted)]/35 px-1 py-2">
                    No print history yet.
                  </p>
                )}
                {synthesis.prints.map((p, i) => (
                  <PrintRow
                    key={p.id ?? `${p.date}-${i}`}
                    print={p}
                    variant={(p as { variant?: string | null }).variant ?? null}
                  />
                ))}
              </div>

              {/* AI synthesis confidence — Nothing-Design fuse footer */}
              <ConfidenceFuse confidence={synthesis.confidence} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintRow({
  print,
  variant,
}: {
  print: EconHistoryPrint;
  variant: string | null;
}) {
  const deviationColor = priorityDeviationColor(print.surprise);
  return (
    <div className="grid grid-cols-[68px_1fr_56px_56px_56px_64px] gap-2 px-1 py-1.5 border-b border-[var(--fintheon-border)]/5 text-[10px]">
      <span className="text-[var(--fintheon-muted)]/55 font-mono">
        {print.date ?? "—"}
      </span>
      <span className="text-[var(--fintheon-text)]/60 truncate">
        {variant ?? "—"}
      </span>
      <span className="text-right text-[var(--fintheon-text)]/45 font-mono">
        {print.previous ?? "—"}
      </span>
      <span className="text-right text-[var(--fintheon-text)]/65 font-mono">
        {print.forecast ?? "—"}
      </span>
      <span
        className="text-right font-mono"
        style={{
          fontFamily: "Doto, ui-monospace, monospace",
          color: "var(--fintheon-text)",
          letterSpacing: "0.02em",
        }}
      >
        {print.actual ?? "—"}
      </span>
      <span
        className="text-right font-mono font-semibold"
        style={{ color: deviationColor }}
      >
        {print.surprise != null
          ? `${print.surprise > 0 ? "+" : ""}${print.surprise.toFixed(2)}%`
          : "—"}
      </span>
    </div>
  );
}

function ForecastChip({
  direction,
  deviation,
}: {
  direction: "beat" | "miss" | "inline";
  deviation: number | null;
}) {
  const isBeat = direction === "beat";
  const color = isBeat ? "var(--fintheon-low)" : "var(--fintheon-severe)";
  return (
    <div
      className="self-start flex items-center gap-2 px-2 py-1 rounded border"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span
        className="text-[8px] tracking-[0.22em] uppercase"
        style={{ color, fontFamily: "var(--font-heading)" }}
      >
        Forecast
      </span>
      <span
        className="text-[10px] font-bold"
        style={{
          color,
          fontFamily: "Doto, ui-monospace, monospace",
          letterSpacing: "0.02em",
        }}
      >
        {direction.toUpperCase()}
        {deviation != null
          ? ` · ${deviation > 0 ? "+" : ""}${deviation.toFixed(2)}%`
          : ""}
      </span>
    </div>
  );
}

function ConfidenceFuse({ confidence }: { confidence: number }) {
  const pct = Math.max(0, Math.min(1, confidence)) * 100;
  const color =
    pct >= 75
      ? "var(--fintheon-low)"
      : pct >= 50
        ? "var(--fintheon-accent)"
        : "var(--fintheon-severe)";
  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex items-baseline justify-between">
        <span
          className="text-[8px] tracking-[0.22em] uppercase text-[var(--fintheon-muted)]/55"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          AI Synthesis Confidence
        </span>
        <span
          className="text-[11px] font-bold"
          style={{
            color,
            fontFamily: "Doto, ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--fintheon-border)]/12 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function FadingHRule() {
  return (
    <div className="h-px relative my-1">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, var(--fintheon-accent) 50%, transparent 100%)",
          opacity: 0.18,
        }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function priorityDeviationColor(surprise: number | null): string {
  if (surprise == null) return "var(--fintheon-muted)";
  const abs = Math.abs(surprise);
  if (abs >= 5) return "var(--fintheon-severe)";
  if (abs >= 2) return "var(--fintheon-neutral-severe)";
  return "var(--fintheon-low)";
}

function deriveDescription(
  event: EconEventCardData,
  prints: EconHistoryPrint[],
): string {
  if (prints.length === 0) {
    return `${event.name} has no recent prints in the selected window. Awaiting next release${event.nextRelease ? ` on ${event.nextRelease}` : ""}.`;
  }
  const latest = prints[0];
  const dirLabel =
    latest.direction === "beat"
      ? "beat consensus"
      : latest.direction === "miss"
        ? "missed consensus"
        : "printed inline";
  return `Most recent ${event.name} release ${dirLabel}${
    latest.surprise != null
      ? ` by ${latest.surprise > 0 ? "+" : ""}${latest.surprise.toFixed(2)}%`
      : ""
  }. Across ${prints.length} prints in the window, the IV-weighted impact has tracked ${
    avgIv(prints) >= 5 ? "elevated" : "muted"
  }.`;
}

function deriveThirdOrder(
  event: EconEventCardData,
  prints: EconHistoryPrint[],
): string {
  if (prints.length < 2) {
    return "Insufficient history to map second-order rate-path implications. Watch the next print for a directional anchor.";
  }
  const beats = prints.filter((p) => p.direction === "beat").length;
  const misses = prints.filter((p) => p.direction === "miss").length;
  if (beats > misses * 1.5) {
    return "Repeated upside surprises shift the consensus distribution — rate-path expectations re-price hawkishly, term premium expands, /ZN takes the brunt.";
  }
  if (misses > beats * 1.5) {
    return "Persistent downside surprises soften forward guidance — risk-on flows return, vol compresses, but tail risk in credit widens silently.";
  }
  return "Mixed prints keep the regime balanced — vol stays bid into the next print, no single-side conviction warranted.";
}

function avgIv(prints: EconHistoryPrint[]): number {
  const vals = prints
    .map((p) => p.ivScore)
    .filter((v): v is number => v != null);
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
