// [claude-code 2026-04-19] S25-T5: Replaces PolymarketPredictionCards' kanban-style grid on Risk & Narratives. One row per trade, age-collapse policy — rows older than AGE_FRESH_HOURS fold into a STALE drawer unless traction spikes. Columns: Question · Side · Entry · Traction · Origin · Age. No card borders, no kanban, fading horizontal rulers between rows.
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Loader2,
  ExternalLink,
} from "@/components/shared/iso-icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

const AGE_FRESH_HOURS = 48;
const TRACTION_REVIVAL = 75; // stale rows with traction >= this stay visible

interface PolymarketOutlook {
  slug: string;
  question: string;
  yesPrice: number;
  fuseConfidence?: number;
  volume: number;
  category?: string;
  closeTime?: string;
  createdAt?: string;
  // If the backend ever surfaces a polybot origin flag
  origin?: "pm" | "polybot";
}

const CACHE_KEY = "fintheon:polymarket-predictions";

function loadCached(): PolymarketOutlook[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatPrice(p: number): string {
  return `${(p * 100).toFixed(0)}¢`;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function ageHours(row: PolymarketOutlook): number {
  const ref = row.createdAt ?? row.closeTime;
  if (!ref) return 0;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.max(0, ms / 3_600_000);
}

function ageLabel(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function tractionScore(row: PolymarketOutlook): number {
  // Normalize volume ($50k ≈ 60, $500k ≈ 80, $5M ≈ 100) and blend with fuse confidence when present.
  const volScore = Math.min(100, Math.log10(Math.max(1, row.volume)) * 20);
  const fuse = row.fuseConfidence ?? volScore;
  return Math.round(0.6 * volScore + 0.4 * fuse);
}

function tractionColor(s: number): string {
  if (s >= 80) return "var(--fintheon-low)";
  if (s >= 60) return "var(--fintheon-accent)";
  if (s >= 40) return "var(--fintheon-neutral-severe)";
  return "var(--fintheon-severe)";
}

function originLabel(origin: PolymarketOutlook["origin"]): string {
  return origin === "polybot" ? "POLYBOT" : "PM";
}

export function ConsolidatedTradeLedger() {
  const cached = loadCached();
  const [rows, setRows] = useState<PolymarketOutlook[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [staleOpen, setStaleOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/predictions/polymarket-outlook`);
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const items: PolymarketOutlook[] = data.markets ?? data.outlook ?? [];
        if (!cancelled && items.length > 0) {
          setRows(items);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(items));
          } catch {}
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { fresh, stale } = useMemo(() => {
    const f: PolymarketOutlook[] = [];
    const s: PolymarketOutlook[] = [];
    for (const row of rows) {
      const traction = tractionScore(row);
      const age = ageHours(row);
      if (age <= AGE_FRESH_HOURS || traction >= TRACTION_REVIVAL) {
        f.push(row);
      } else {
        s.push(row);
      }
    }
    f.sort((a, b) => tractionScore(b) - tractionScore(a));
    s.sort((a, b) => tractionScore(b) - tractionScore(a));
    return { fresh: f, stale: s };
  }, [rows]);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-2 pb-2">
        <span
          className="text-[10px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/80"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Trade Ledger
        </span>
        <span className="text-[8px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/40">
          Prediction markets · Polybot
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_44px_60px_78px_60px_48px] gap-2 px-2 py-1.5 text-[8px] tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/40 border-b border-[var(--fintheon-border)]/8">
        <span>Question</span>
        <span className="text-right">Side</span>
        <span className="text-right">Entry</span>
        <span className="text-right">Traction</span>
        <span className="text-right">Origin</span>
        <span className="text-right">Age</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-2 py-3 text-[10px] text-[var(--fintheon-muted)]/40">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading trades…
        </div>
      )}

      {!loading && fresh.length === 0 && stale.length === 0 && (
        <p className="px-2 py-3 text-[10px] text-[var(--fintheon-muted)]/35">
          No active trades.
        </p>
      )}

      <div className="flex flex-col">
        {fresh.map((row) => (
          <LedgerRow key={row.slug} row={row} />
        ))}
      </div>

      {stale.length > 0 && (
        <div className="mt-1 border-t border-[var(--fintheon-border)]/8">
          <button
            type="button"
            onClick={() => setStaleOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[9px] tracking-[0.2em] uppercase text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            <ChevronDown
              size={10}
              className="transition-transform"
              style={{
                transform: staleOpen ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
            Stale ({stale.length})
          </button>
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-300"
            style={{
              maxHeight: staleOpen ? "800px" : "0px",
              opacity: staleOpen ? 1 : 0,
            }}
          >
            {stale.map((row) => (
              <LedgerRow key={row.slug} row={row} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LedgerRow({
  row,
  dimmed,
}: {
  row: PolymarketOutlook;
  dimmed?: boolean;
}) {
  const traction = tractionScore(row);
  const tColor = tractionColor(traction);
  const sideLabel = row.yesPrice >= 0.5 ? "YES" : "NO";
  const sideColor =
    row.yesPrice >= 0.5 ? "var(--fintheon-low)" : "var(--fintheon-severe)";
  const age = ageHours(row);

  return (
    <a
      href={`https://polymarket.com/market/${row.slug}`}
      target="_blank"
      rel="noreferrer"
      className={`grid grid-cols-[1fr_44px_60px_78px_60px_48px] gap-2 px-2 py-1.5 items-center text-[10px] border-b border-[var(--fintheon-border)]/6 hover:bg-[var(--fintheon-accent)]/4 transition-colors group ${
        dimmed ? "opacity-55 hover:opacity-90" : ""
      }`}
    >
      <span className="truncate text-[var(--fintheon-text)]/75 flex items-center gap-1.5">
        <span className="truncate">{row.question}</span>
        <ExternalLink
          size={9}
          className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
        />
      </span>
      <span
        className="text-right text-[9px] font-semibold"
        style={{ color: sideColor }}
      >
        {sideLabel}
      </span>
      <span
        className="text-right font-bold"
        style={{
          color: "var(--fintheon-text)",
          fontFamily: "Doto, ui-monospace, monospace",
          letterSpacing: "0.02em",
        }}
      >
        {formatPrice(row.yesPrice)}
      </span>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-[3px] rounded-full bg-[var(--fintheon-border)]/12 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${traction}%`, backgroundColor: tColor }}
          />
        </div>
        <span
          className="font-bold w-[22px] text-right"
          style={{
            color: tColor,
            fontFamily: "Doto, ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {traction}
        </span>
      </div>
      <span
        className="text-right text-[8px] tracking-[0.16em] uppercase text-[var(--fintheon-muted)]/55"
        title={`Volume ${formatVolume(row.volume)}`}
      >
        {originLabel(row.origin)}
      </span>
      <span className="text-right text-[9px] text-[var(--fintheon-muted)]/50 font-mono">
        {ageLabel(age)}
      </span>
    </a>
  );
}
