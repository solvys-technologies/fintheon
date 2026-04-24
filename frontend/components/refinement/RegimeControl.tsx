// [claude-code 2026-03-27] S2-T7: Regime control panel — display + manual override
import { useState, useEffect } from "react";
import { Shield, ChevronDown } from "lucide-react";
import {
  MARKET_REGIMES,
  REGIME_LABELS,
  type MarketRegime,
} from "../../types/regime";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface RegimeState {
  regime: MarketRegime;
  confidence: number;
  detectedBy: string;
  multipliers?: Record<string, number>;
}

const REGIME_COLORS: Record<MarketRegime, string> = {
  BULL_TREND: "text-emerald-400",
  BEAR_TREND: "text-red-400",
  CONSOLIDATION: "text-zinc-400",
  GEO_TENSIONS: "text-orange-400",
  MACRO_ECON: "text-cyan-400",
  RISK_OFF: "text-rose-400",
  EARNINGS_SEASON: "text-violet-400",
  ILLIQUID_STUPIDITY: "text-amber-400",
};

interface RegimeControlProps {
  regime: RegimeState | null;
  onRegimeChanged: () => void;
}

export function RegimeControl({ regime, onRegimeChanged }: RegimeControlProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [hint, setHint] = useState("");
  // Optimistic local override — shows selection immediately, not after parent refetch
  const [localOverride, setLocalOverride] = useState<MarketRegime | null>(null);

  // Clear local override when parent regime updates to match
  useEffect(() => {
    if (regime?.regime && localOverride && regime.regime === localOverride) {
      setLocalOverride(null);
    }
  }, [regime?.regime, localOverride]);

  const handleOverride = async (newRegime: MarketRegime) => {
    setOverriding(true);
    setDropdownOpen(false);
    setLocalOverride(newRegime); // Show selection immediately
    try {
      await fetch(`${API_BASE}/api/regime/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regime: newRegime,
          notes: "Manual override from Refinement Engine",
        }),
      }).then((r) => r.json());
      setHint("Regime changed — Re-Score All to apply");
      onRegimeChanged();
    } catch (err) {
      console.error("[RegimeControl] Override failed:", err);
      setLocalOverride(null); // Revert on failure
    } finally {
      setOverriding(false);
    }
  };

  // Clear hint after 8 seconds
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(""), 8000);
    return () => clearTimeout(t);
  }, [hint]);

  const currentRegime = localOverride ?? regime?.regime ?? "CONSOLIDATION";
  const colorClass =
    REGIME_COLORS[currentRegime] ?? REGIME_COLORS.CONSOLIDATION;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--fintheon-text)]/70 uppercase tracking-wider">
        <Shield className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
        Active Regime
      </div>

      {/* Current regime badge */}
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold tracking-wide ${colorClass}`}
      >
        {REGIME_LABELS[currentRegime]}
      </div>

      {/* Confidence + source */}
      <div className="text-[10px] text-zinc-500 space-y-0.5">
        <div>
          Confidence:{" "}
          {regime ? `${Math.round(regime.confidence * 100)}%` : "\u2014"}
        </div>
        <div>Source: {regime?.detectedBy ?? "unknown"}</div>
      </div>

      {/* Override dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={overriding}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-700 text-[10px] text-zinc-400 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/30 transition-colors disabled:opacity-50"
        >
          {overriding ? "Overriding..." : "Override"}
          <ChevronDown className="w-3 h-3" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-1 left-0 w-52 rounded border border-zinc-700 bg-[var(--fintheon-surface)] shadow-lg py-1">
            {MARKET_REGIMES.map((r) => (
              <button
                key={r}
                onClick={() => handleOverride(r)}
                className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors hover:bg-[var(--fintheon-accent)]/10 ${
                  r === currentRegime
                    ? "text-[var(--fintheon-accent)] font-bold"
                    : "text-zinc-400"
                }`}
              >
                {REGIME_LABELS[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hint after override */}
      {hint && (
        <div className="text-[9px] text-[var(--fintheon-accent)]/80 animate-pulse">
          {hint}
        </div>
      )}
    </div>
  );
}
