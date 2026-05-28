// [Codex 2026-05-27] Extracted Arbitrum chamber header actions.
import { Settings } from "lucide-react";

interface ArbitrumChamberHeaderProps {
  selectedInstrument: string;
  phaseNotice: string | null;
  onInstrumentChange: (instrument: string) => void;
  onOpenPresets: () => void;
  onToggleSettings: () => void;
}

const INSTRUMENTS = [
  "/NQ",
  "/ES",
  "/YM",
  "/RTY",
  "/CL",
  "/GC",
  "/ZB",
  "/ZN",
  "/ZT",
  "/BTC",
  "/ETH",
  "/6E",
  "/6J",
  "/6B",
  "/6A",
  "/6C",
  "/6S",
];

export function ArbitrumChamberHeader({
  selectedInstrument,
  phaseNotice,
  onInstrumentChange,
  onOpenPresets,
  onToggleSettings,
}: ArbitrumChamberHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/60">
          Arbitrum Chamber
        </span>
        <select
          value={selectedInstrument}
          onChange={(e) => onInstrumentChange(e.target.value)}
          className="rounded border border-[var(--fintheon-accent)]/20 bg-transparent px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/60 focus:border-[var(--fintheon-accent)]/50 focus:outline-none"
          style={{ fontFamily: "var(--font-data, monospace)" }}
        >
          {INSTRUMENTS.map((symbol) => (
            <option
              key={symbol}
              value={symbol}
              className="bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]"
            >
              {symbol}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        {phaseNotice ? (
          <span
            key={phaseNotice}
            className="fintheon-status-notice-fade text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/45"
          >
            {phaseNotice}
          </span>
        ) : null}
        <button
          onClick={onOpenPresets}
          className="rounded px-1.5 py-1 text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)]/55 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
          aria-label="Arbitrum run presets"
          title="Presets"
        >
          Presets
        </button>
        <button
          onClick={onToggleSettings}
          className="rounded p-1 transition-colors hover:bg-[var(--fintheon-accent)]/10"
          aria-label="Chamber settings"
          title="Chamber Settings"
        >
          <Settings className="h-3.5 w-3.5 text-[var(--fintheon-accent)]/50 transition-colors hover:text-[var(--fintheon-accent)]" />
        </button>
      </div>
    </div>
  );
}
