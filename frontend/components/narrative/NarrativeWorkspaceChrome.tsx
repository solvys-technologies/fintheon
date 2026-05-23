import { GitBranch, LayoutDashboard, Network } from "lucide-react";
import type { ReactNode } from "react";
import { NarrativeSituationMap } from "./NarrativeSituationMap";
import type {
  SensemakingOrientation,
  SensemakingRenderMode,
} from "./sensemaking-types";
import type { NarrativeSituationMapState } from "../../hooks/useNarrativeSituationMap";

interface NarrativeWorkspaceTopBarProps {
  themes: number;
  orientation: SensemakingOrientation;
  renderMode: SensemakingRenderMode;
  onBack: () => void;
  onOpenSituation: () => void;
  onOrientationChange: (value: SensemakingOrientation) => void;
  onRenderModeChange: (value: SensemakingRenderMode) => void;
}

export function NarrativeWorkspaceTopBar({
  themes,
  orientation,
  renderMode,
  onBack,
  onOpenSituation,
  onOrientationChange,
  onRenderModeChange,
}: NarrativeWorkspaceTopBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex h-[50px] items-center justify-between border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)]/90 px-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-8 rounded-md border border-[var(--fintheon-accent)]/15 px-3 text-xs text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/35 hover:text-[var(--fintheon-accent)]"
        >
          Sessions
        </button>
        <button
          type="button"
          onClick={onOpenSituation}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/15 px-3 text-xs text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/35 hover:text-[var(--fintheon-accent)]"
        >
          <Network size={14} />
          Situation
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
        <GitBranch size={13} />
        <span>{themes} themes indexed</span>
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          value={orientation}
          options={[
            ["horizontal", "Left to Right"],
            ["vertical", "Top Down"],
          ]}
          onChange={(value) => onOrientationChange(value as SensemakingOrientation)}
        />
        <Segmented
          value={renderMode}
          options={[
            ["flow", "Map"],
            ["mermaid", "Mermaid"],
          ]}
          onChange={(value) => onRenderModeChange(value as SensemakingRenderMode)}
          icon={<LayoutDashboard size={12} />}
        />
      </div>
    </div>
  );
}

export function NarrativeSituationOverlay({
  isOpen,
  situation,
  onClose,
}: {
  isOpen: boolean;
  situation: NarrativeSituationMapState;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-4 z-40 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]">
      <div className="flex h-10 items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          Situation Map
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)]"
        >
          Close
        </button>
      </div>
      <div className="h-[calc(100%-40px)]">
        <NarrativeSituationMap
          map={situation.map}
          isLoading={situation.isLoading}
          error={situation.error}
        />
      </div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  icon,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/55 p-1">
      {icon}
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
            value === id
              ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
              : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
