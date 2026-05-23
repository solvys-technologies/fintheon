import { ChevronDown, LayoutDashboard } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NarrativeSituationMap } from "./NarrativeSituationMap";
import type {
  SensemakingOrientation,
  SensemakingRenderMode,
} from "./sensemaking-types";
import type { NarrativeSituationMapState } from "../../hooks/useNarrativeSituationMap";

interface NarrativeWorkspaceTopBarProps {
  orientation: SensemakingOrientation;
  renderMode: SensemakingRenderMode;
  onOrientationChange: (value: SensemakingOrientation) => void;
  onRenderModeChange: (value: SensemakingRenderMode) => void;
  actionSlot?: ReactNode;
  showViewControls?: boolean;
}

export function NarrativeWorkspaceTopBar({
  orientation,
  renderMode,
  onOrientationChange,
  onRenderModeChange,
  actionSlot,
  showViewControls = true,
}: NarrativeWorkspaceTopBarProps) {
  return (
    <div
      className="absolute inset-x-0 top-0 z-10 flex h-[50px] items-center justify-between bg-[var(--fintheon-bg)]/90 px-3 backdrop-blur-xl"
      style={{
        backgroundImage:
          "linear-gradient(to right, transparent, rgba(199,159,74,0.16), transparent)",
        backgroundPosition: "left bottom",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 1px",
      }}
    >
      <div className="min-w-[260px]" aria-hidden="true" />

      <div className="flex items-center gap-2">
        {actionSlot}
        {showViewControls ? (
          <NarrativeWorkspaceViewMenu
            orientation={orientation}
            renderMode={renderMode}
            onOrientationChange={onOrientationChange}
            onRenderModeChange={onRenderModeChange}
          />
        ) : null}
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

export function NarrativeWorkspaceViewMenu({
  orientation,
  renderMode,
  onOrientationChange,
  onRenderModeChange,
}: {
  orientation: SensemakingOrientation;
  renderMode: SensemakingRenderMode;
  onOrientationChange: (value: SensemakingOrientation) => void;
  onRenderModeChange: (value: SensemakingRenderMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const currentOrientation =
    orientation === "horizontal" ? "Left to Right" : "Top Down";
  const currentRender = renderMode === "flow" ? "Map" : "Mermaid";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition duration-150 hover:-translate-y-px hover:text-[var(--fintheon-text)]"
        title="View controls"
      >
        <LayoutDashboard size={13} />
        Views
        <ChevronDown
          size={12}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-md bg-[var(--fintheon-bg)]/96 py-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[opacity,transform] duration-150"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-4px)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <ViewChoice
          label="Left to Right"
          active={orientation === "horizontal"}
          onClick={() => {
            onOrientationChange("horizontal");
            setOpen(false);
          }}
        />
        <ViewChoice
          label="Top Down"
          active={orientation === "vertical"}
          onClick={() => {
            onOrientationChange("vertical");
            setOpen(false);
          }}
        />
        <div
          className="mx-3 my-1 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(199,159,74,0.14), transparent)",
          }}
        />
        <ViewChoice
          label="Map"
          active={renderMode === "flow"}
          onClick={() => {
            onRenderModeChange("flow");
            setOpen(false);
          }}
        />
        <ViewChoice
          label="Mermaid"
          active={renderMode === "mermaid"}
          onClick={() => {
            onRenderModeChange("mermaid");
            setOpen(false);
          }}
        />
        <div className="px-3 pb-2 pt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--fintheon-muted)]/35">
          {currentOrientation} / {currentRender}
        </div>
      </div>
    </div>
  );
}

function ViewChoice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] uppercase tracking-[0.12em] transition ${
        active
          ? "text-[var(--fintheon-accent)]"
          : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
      }`}
    >
      <span>{label}</span>
      {active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fintheon-accent)]" />
      ) : null}
    </button>
  );
}
