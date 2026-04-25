// [claude-code 2026-04-25] S38: Econ Pulse (EconKpiFuses) wrapped in a collapsible header row;
//   InstrumentCardsRow swapped for AquariumPredictionCards (horizontal heat bars, matches
//   Sanctum Command tab); EconInstrumentFuses dead-file deleted.
// [claude-code 2026-04-24] S35-T12 Phase B: Reflowed Econ Intel header — KPI fuses get
//   their own full-width row (was squeezed left half), InstrumentCardsRow takes the
//   next full-width row (replaces the orphaned EconInstrumentFuses right-column variant),
//   and event cards now render in a 2-column grid so expanded content has legible width.
// [claude-code 2026-04-19] S25-T4a: Econ Intelligence rebuilt as event-filter scroll-lock
//   page. Middle: event-filter dropdown + timespan + Generate. Bottom: chevron event cards
//   with staggered fade-in; each expands to a CAO synthesis + per-print rows + AI-confidence
//   fuse footer. categoryScores + context props kept for back-compat (unused here).
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import type {
  SimulationContext,
  AgentDeskCategoryScore,
} from "../../types/agent-desk";
import { EconKpiFuses } from "./econ/EconKpiFuses";
import { EconEventFilter, type EconTimespan } from "./econ/EconEventFilter";
import { EconEventCard, type EconEventCardData } from "./econ/EconEventCard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Static catalogue of trackable events — enriched from /api/data/econ-calendar at runtime. */
const ECON_CATALOGUE_SEED: EconEventCardData[] = [
  {
    ticker: "CPI",
    name: "Consumer Price Index",
    category: "price-stability",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "PPI",
    name: "Producer Price Index",
    category: "price-stability",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "PCE",
    name: "Personal Consumption Expenditures",
    category: "price-stability",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "NFP",
    name: "Non-Farm Payrolls",
    category: "employment",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "UNEMP",
    name: "Unemployment Rate",
    category: "employment",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "INIT",
    name: "Initial Jobless Claims",
    category: "employment",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "JOLTS",
    name: "Job Openings",
    category: "employment",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "GDP",
    name: "Gross Domestic Product",
    category: "supply-chain",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "PMI",
    name: "Purchasing Managers' Index",
    category: "supply-chain",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "RETA",
    name: "Retail Sales",
    category: "supply-chain",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
  {
    ticker: "FOMC",
    name: "Fed Rate Decision",
    category: "supply-chain",
    releasesCollected: 0,
    lastSeen: null,
    nextRelease: null,
  },
];

interface SanctumEconIntelProps {
  /** @deprecated Kept for back-compat — not used on the new page. */
  expanded?: boolean;
  /** @deprecated Kept for back-compat — not used on the new page. */
  context?: SimulationContext | null;
  /** @deprecated Kept for back-compat — not used on the new page. */
  categoryScores?: AgentDeskCategoryScore[];
}

export function SanctumEconIntel(_props: SanctumEconIntelProps) {
  const [catalogue, setCatalogue] =
    useState<EconEventCardData[]>(ECON_CATALOGUE_SEED);
  const [selection, setSelection] = useState<{
    events: EconEventCardData[];
    timespan: EconTimespan;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(true);

  // Enrich catalogue from /api/data/econ-calendar (next release dates, release counts)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/data/econ-calendar`, {
          signal: controller.signal,
        });
        if (!r.ok || cancelled) return;
        const data = await r.json();
        if (cancelled) return;

        setCatalogue((prev) =>
          prev.map((item) => {
            const match = (data.events ?? []).find(
              (e: { aiTicker?: string; name?: string; country?: string }) =>
                (e.country === "US" ||
                  e.country === "United States" ||
                  !e.country) &&
                (e.aiTicker === item.ticker ||
                  e.name?.toLowerCase().includes(item.ticker.toLowerCase())),
            );
            if (!match) return item;
            return {
              ...item,
              nextRelease: match.date ?? item.nextRelease,
              lastSeen: match.lastPrint?.date ?? item.lastSeen,
              releasesCollected:
                match.releasesCollected ?? item.releasesCollected,
            };
          }),
        );
      } catch {
        /* silent — fuses/catalogue just stay seeded */
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  // Prefill release counts by peeking at econ-history for each ticker in parallel (best-effort)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        ECON_CATALOGUE_SEED.map((s) =>
          fetch(
            `${API_BASE}/api/data/econ-history/${encodeURIComponent(s.ticker)}?limit=50`,
          ).then((r) => (r.ok ? r.json() : null)),
        ),
      );
      if (cancelled) return;
      setCatalogue((prev) =>
        prev.map((item, idx) => {
          const res = results[idx];
          if (res.status !== "fulfilled" || !res.value) return item;
          const history = res.value.history as
            | { date: string | null }[]
            | undefined;
          if (!history) return item;
          const latestDate = history[0]?.date ?? item.lastSeen;
          return {
            ...item,
            releasesCollected: history.length,
            lastSeen: latestDate,
          };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pulses = useMemo(() => computePulses(catalogue), [catalogue]);

  const handleGenerate = (next: {
    events: EconEventCardData[];
    timespan: EconTimespan;
  }) => {
    setGenerating(true);
    setSelection(null);
    // Small delay so the fade-out/fade-in reads as a deliberate transition rather than a flash
    setTimeout(() => {
      setSelection(next);
      setGenerating(false);
    }, 220);
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* ── Econ Pulse — collapsible header + fuses block ── */}
      <div className="shrink-0 flex flex-col">
        <button
          type="button"
          onClick={() => setPulseOpen((v) => !v)}
          aria-expanded={pulseOpen}
          className="flex items-center justify-between w-full py-2 group cursor-pointer text-left"
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--fintheon-accent)]/85 group-hover:text-[var(--fintheon-accent)] transition-colors"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Econ Pulse
          </span>
          {pulseOpen ? (
            <ChevronDown
              size={14}
              className="text-[var(--fintheon-muted)]/70 group-hover:text-[var(--fintheon-accent)] transition-colors"
            />
          ) : (
            <ChevronRight
              size={14}
              className="text-[var(--fintheon-muted)]/70 group-hover:text-[var(--fintheon-accent)] transition-colors"
            />
          )}
        </button>
        {pulseOpen && (
          <div className="rounded-md overflow-hidden">
            <EconKpiFuses
              catalogue={catalogue}
              inflationPulse={pulses.inflation}
              laborPulse={pulses.labor}
              supplyPulse={pulses.supply}
            />
          </div>
        )}
      </div>

      {/* Fading horizontal ruler */}
      <FadingHRule />

      {/* ── Event filter ── */}
      <div className="shrink-0">
        <EconEventFilter
          catalogue={catalogue}
          isGenerating={generating}
          onGenerate={handleGenerate}
        />
      </div>

      {/* ── Progressive card container — 2-column grid so expanded cards
            render side-by-side at half-width (still legible: per-print rows,
            CAO synthesis, AI confidence fuse). Single column on narrow panes. ── */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-[var(--fintheon-accent)]/8 bg-[var(--fintheon-surface)]/20">
        {!selection && !generating && (
          <div className="h-full flex flex-col items-center justify-center gap-2 py-8 text-[var(--fintheon-muted)]/45">
            <CalendarClock className="w-5 h-5" />
            <p className="text-[11px]">
              Pick up to 4 events and a timespan, then hit Generate.
            </p>
          </div>
        )}
        {selection && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
            {selection.events.map((evt, idx) => (
              <EconEventCard
                key={evt.ticker}
                event={evt}
                appearDelay={idx * 120}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function computePulses(catalogue: EconEventCardData[]): {
  inflation?: number;
  labor?: number;
  supply?: number;
} {
  // Pulses are placeholders in 4a — they'll be driven by /api/econ/synthesize in 4b.
  // For now: linear scaling of per-category coverage so the fuses render believably instead of at 0.
  const byCat = {
    "price-stability": catalogue.filter(
      (c) => c.category === "price-stability",
    ),
    employment: catalogue.filter((c) => c.category === "employment"),
    "supply-chain": catalogue.filter((c) => c.category === "supply-chain"),
  };
  const score = (items: EconEventCardData[]) => {
    if (items.length === 0) return undefined;
    const covered = items.filter((i) => i.releasesCollected > 0).length;
    // Placeholder: 3 + 4*coverageRatio so filled pulses hover around 3–7 by default
    return 3 + 4 * (covered / items.length);
  };
  return {
    inflation: score(byCat["price-stability"]),
    labor: score(byCat["employment"]),
    supply: score(byCat["supply-chain"]),
  };
}

function FadingHRule() {
  return (
    <div className="h-px relative">
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
