// [Codex 2026-05-27] Passwordless manual-run preset selector.
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";
import { FadingRuler } from "../shared/FadingRuler";
import type { ArbitrumRunPreset, ArbitrumRunPresetId } from "./run-presets";
import {
  ARBITRUM_RUN_PRESETS,
  loadSelectedArbitrumRunPresetIds,
  saveSelectedArbitrumRunPresetIds,
} from "./run-presets";

interface ArbitrumPresetPanelProps {
  onClose: () => void;
  onSaved: () => void;
}

type SaveState = "idle" | "saving" | "saved";

export function ArbitrumPresetPanel({
  onClose,
  onSaved,
}: ArbitrumPresetPanelProps) {
  const [selectedIds, setSelectedIds] = useState<ArbitrumRunPresetId[]>(() =>
    loadSelectedArbitrumRunPresetIds(),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const rows = useMemo(
    () => [ARBITRUM_RUN_PRESETS.slice(0, 4), ARBITRUM_RUN_PRESETS.slice(4)],
    [],
  );

  const togglePreset = (id: ArbitrumRunPresetId) => {
    if (saveState !== "idle") return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSave = () => {
    if (saveState !== "idle") return;
    const saved = saveSelectedArbitrumRunPresetIds(selectedIds);
    setSelectedIds(saved);
    setSaveState("saving");
    window.setTimeout(() => setSaveState("saved"), 360);
    window.setTimeout(onSaved, 1180);
  };

  return (
    <div
      className="fintheon-modal-surface absolute inset-0 z-50 flex flex-col animate-fade-in"
      role="dialog"
      aria-label="Arbitrum Presets"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--fintheon-accent)]/15 px-4 py-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)]">
          Presets
        </span>
        <button
          onClick={onClose}
          className="rounded p-1 transition-colors hover:bg-[var(--fintheon-accent)]/10"
          aria-label="Close presets"
          disabled={saveState !== "idle"}
        >
          <X className="h-4 w-4 text-[var(--fintheon-text)]/60" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          <PresetRow
            presets={rows[0]}
            selectedIds={selectedIds}
            onToggle={togglePreset}
            disabled={saveState !== "idle"}
          />
          <FadingRuler className="my-1 opacity-60" />
          <PresetRow
            presets={rows[1]}
            selectedIds={selectedIds}
            onToggle={togglePreset}
            disabled={saveState !== "idle"}
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            {selectedIds.length} selected
          </span>
          <button
            onClick={handleSave}
            disabled={saveState !== "idle"}
            className="inline-flex min-h-[30px] items-center gap-2 rounded border border-[var(--fintheon-accent)]/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-75"
          >
            {saveState === "idle" ? (
              "Save Selection"
            ) : saveState === "saving" ? (
              <DotMatrixLoader
                variant="verify"
                size={16}
                color="rgb(52 211 153)"
                label="Saving"
              />
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <DotMatrixLoader
                  variant="verify"
                  size={15}
                  color="rgb(52 211 153)"
                  label="Saved"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PresetRow({
  presets,
  selectedIds,
  disabled,
  onToggle,
}: {
  presets: readonly ArbitrumRunPreset[];
  selectedIds: readonly ArbitrumRunPresetId[];
  disabled: boolean;
  onToggle: (id: ArbitrumRunPresetId) => void;
}) {
  const gridClass = presets.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-2 ${gridClass}`}>
      {presets.map((preset) => {
        const selected = selectedIds.includes(preset.id);
        return (
          <button
            key={preset.id}
            onClick={() => onToggle(preset.id)}
            disabled={disabled}
            aria-pressed={selected}
            className={`min-h-[88px] min-w-0 rounded border p-3 text-left transition-colors ${
              selected
                ? "border-[var(--fintheon-accent)]/45 bg-[var(--fintheon-accent)]/10"
                : "border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/45 hover:border-[var(--fintheon-accent)]/24"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wider text-[var(--fintheon-text)]/78">
              {preset.label}
            </span>
            <span className="mt-1.5 block text-[10px] leading-4 text-[var(--fintheon-text)]/45">
              {preset.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
