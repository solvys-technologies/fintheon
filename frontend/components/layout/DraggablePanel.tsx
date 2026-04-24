// [claude-code 2026-04-17] Migrated to useDraggable hook (pointer events + rAF + transform3d); grip-only handle; removed shadow-2xl per Nothing-Design
import { useRef, ReactNode } from "react";
import { GripVertical, X } from "lucide-react";
import { useDraggable } from "../../hooks/useDraggable";

export type PanelPosition = "left" | "right" | "floating";

interface DraggablePanelProps {
  children: ReactNode;
  title: string;
  defaultPosition?: PanelPosition;
  onPositionChange?: (position: PanelPosition) => void;
  onClose?: () => void;
  className?: string;
  storageKey?: string;
}

export function DraggablePanel({
  children,
  title,
  defaultPosition = "right",
  onPositionChange,
  onClose,
  className = "",
  storageKey = "fintheon:draggable-panel-pos",
}: DraggablePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);

  const handlePositionChange = (newPosition: PanelPosition) => {
    onPositionChange?.(newPosition);
  };

  useDraggable({
    elementRef: panelRef,
    handleRef: gripRef,
    storageKey,
    bounds: "viewport",
    disabled: defaultPosition !== "floating",
  });

  const baseClasses =
    "bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 flex flex-col";

  if (defaultPosition === "floating") {
    return (
      <div
        ref={panelRef}
        className={`${baseClasses} fixed z-50 rounded-lg ${className}`}
        style={{ top: 0, left: 0, width: "320px", height: "400px" }}
      >
        <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/20">
          <div className="flex items-center gap-2">
            <button
              ref={gripRef}
              className="p-1 rounded cursor-grab active:cursor-grabbing text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] touch-none"
              title="Drag"
              aria-label="Drag panel"
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePositionChange("right")}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] text-xs"
              title="Dock Right"
            >
              →
            </button>
            <button
              onClick={() => handlePositionChange("left")}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] text-xs"
              title="Dock Left"
            >
              ←
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--fintheon-accent)]/20">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
          {title}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              handlePositionChange(
                defaultPosition === "left" ? "right" : "left",
              )
            }
            className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] text-xs"
            title={defaultPosition === "left" ? "Move Right" : "Move Left"}
          >
            {defaultPosition === "left" ? "→" : "←"}
          </button>
          <button
            onClick={() => handlePositionChange("floating")}
            className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
            title="Float"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)]"
              title="Hide"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
