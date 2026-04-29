// [claude-code 2026-04-28] T3: Removed Upload button + modal; Zap → RefreshCw.
// [claude-code 2026-03-24] Persistence refactor: Run → Update button label when data exists
// [claude-code 2026-03-23] Persistent Sanctum header — presets, run button, status, rolling period
// [claude-code 2026-03-25] Theme-sensitive fonts — use var(--font-heading) and var(--font-body)
// [claude-code 2026-04-25] S38: Aquarium → Arbitrum UI surface rename. Header lockup bumped, "shark tank" subtitle removed.
import { RefreshCw, Loader2 } from "lucide-react";
import type { SanctumPreset } from "../../types/agent-desk";
import { SanctumPresets } from "./SanctumPresets";
import { SanctumOpsChips } from "./SanctumOpsChips";

interface SanctumHeaderProps {
  preset: SanctumPreset;
  onPresetChange: (p: SanctumPreset) => void;
  onRun: () => void;
  isLoading: boolean;
  status: "idle" | "running" | "complete" | "error";
  hasData: boolean;
}

export function SanctumHeader({
  preset,
  onPresetChange,
  onRun,
  isLoading,
  status,
  hasData,
}: SanctumHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/10">
      <div className="flex items-center gap-3">
        <span
          className="text-[15px] font-bold text-[var(--fintheon-accent)]/85 uppercase tracking-widest"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Arbitrum
        </span>
        {status === "complete" && (
          <span
            className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-low)]/10 text-[var(--fintheon-low)] font-bold"
            style={{ fontFamily: "var(--font-body)" }}
          >
            LIVE
          </span>
        )}
        {status === "error" && (
          <span
            className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-severe)]/10 text-[var(--fintheon-severe)] font-bold"
            style={{ fontFamily: "var(--font-body)" }}
          >
            ERROR
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SanctumOpsChips />

        <SanctumPresets active={preset} onChange={onPresetChange} />

        <button
          onClick={onRun}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {isLoading ? "Updating..." : hasData ? "Update" : "Run"}
        </button>
      </div>
    </div>
  );
}
