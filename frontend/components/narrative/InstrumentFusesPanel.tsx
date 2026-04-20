// [claude-code 2026-04-19] v5.22 S1: Compact instrument fuses panel — right column of
//   Sanctum's Econ Intelligence page. Renders /NQ /ES /YM /CL /GC as vertical fuses with
//   symbol + IV score, sourcing data from the same predictions/outlook endpoint that
//   powers AquariumPredictionCards.
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "@/components/shared/iso-icons";
import { NothingFuse } from "../shared/NothingFuse";
import { severityFromScore } from "../../lib/fuse-palette";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CACHE_KEY = "fintheon:aquarium-predictions";

interface InstrumentOutlook {
  symbol: string;
  ivScore: number;
  lean: "bullish" | "bearish" | "neutral";
}

function loadCached(): InstrumentOutlook[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function InstrumentFusesPanel() {
  const [outlook, setOutlook] = useState<InstrumentOutlook[]>(loadCached());
  const [loading, setLoading] = useState(outlook.length === 0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOutlook = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/predictions/outlook`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const instruments = data.instruments ?? [];
        if (!cancelled && instruments.length > 0) setOutlook(instruments);
      } catch (err) {
        console.warn("[InstrumentFuses] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOutlook();
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchOutlook();
    }, 30_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="h-full rounded-xl border border-[var(--fintheon-accent)]/12 bg-[color-mix(in_srgb,var(--fintheon-surface)_70%,transparent)] backdrop-blur-sm p-4 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--fintheon-accent)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Instrument Fuses
        </span>
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin text-[var(--fintheon-accent)]/50" />
        )}
      </div>
      {outlook.length === 0 && !loading && (
        <div className="text-center text-[9px] text-[var(--fintheon-muted)]/40 pt-6">
          No instrument data — run the brief to populate
        </div>
      )}
      {outlook.length > 0 && (
        <div className="flex-1 grid grid-cols-5 gap-3 items-stretch">
          {outlook.map((inst) => (
            <InstrumentFuseCell key={inst.symbol} inst={inst} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstrumentFuseCell({ inst }: { inst: InstrumentOutlook }) {
  const pct = Math.min(1, Math.max(0, inst.ivScore / 10));
  return (
    <div className="min-w-0 flex flex-col items-center gap-2">
      <span className="text-[10px] font-mono font-bold text-[var(--fintheon-accent)] tracking-[0.08em]">
        {inst.symbol}
      </span>
      <div className="flex-1 min-h-[120px] w-full flex justify-center">
        <NothingFuse
          value={pct}
          severity={severityFromScore(inst.ivScore)}
          orientation="vertical"
          thickness={8}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--fintheon-text)]">
        {inst.ivScore.toFixed(1)}
      </span>
      <span className="text-[8px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]/60">
        {inst.lean}
      </span>
    </div>
  );
}
