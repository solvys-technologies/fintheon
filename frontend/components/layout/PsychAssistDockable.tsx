// [claude-code 2026-04-17] Migrated drag to useDraggable hook (pointer events + rAF); grip-only; dock-on-release via onDragEnd
// [claude-code 2026-04-20] S21: Voice activation button + live waveform indicator
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GripVertical, PictureInPicture2, X } from "lucide-react";
import { CompactERMonitor } from "../mission-control/CompactERMonitor";
import { useDraggable } from "../../hooks/useDraggable";
// [claude-code 2026-04-24] WhiteWaveform + per-widget MessageSquare "Talk to
// Coach" button removed. Voice is owned by the orb (HeaderVoiceControl) only;
// the standalone AgentVoiceWaveform overlay handles user-mic + agent-voice
// rendering. PsychAssist itself is just a status badge now.

export type PsychAssistDockTarget = "floating" | "header";

interface PsychAssistDockableProps {
  target: PsychAssistDockTarget;
  onDockToHeader: () => void;
  onUndockToFloating: () => void;
  onClose?: () => void;
  storageKey?: string;
  headerDockZoneId?: string;
}

export function PsychAssistDockable({
  target,
  onDockToHeader,
  onUndockToFloating,
  onClose,
  storageKey = "fintheon:psychassist-floating-pos:v1",
  headerDockZoneId = "fintheon-heading-toolbar",
}: PsychAssistDockableProps) {
  const [headerVisible, setHeaderVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);

  const floating = target === "floating";

  const defaultPos = useMemo(() => {
    if (typeof window === "undefined") return { x: 24, y: 86 };
    return { x: Math.max(24, window.innerWidth - 360), y: 86 };
  }, []);

  const handleDragEnd = useCallback(
    (finalPos: { x: number; y: number }) => {
      const dockZone = document.getElementById(headerDockZoneId);
      if (!dockZone) return;
      const rect = dockZone.getBoundingClientRect();
      // Use the centre-ish of the grip (finalPos + offset)
      const probeX = finalPos.x + 14;
      const probeY = finalPos.y + 14;
      const inside =
        probeX >= rect.left &&
        probeX <= rect.right &&
        probeY >= rect.top &&
        probeY <= rect.bottom;
      if (inside) onDockToHeader();
    },
    [headerDockZoneId, onDockToHeader],
  );

  useDraggable({
    elementRef: panelRef,
    handleRef: gripRef,
    storageKey,
    bounds: "viewport",
    initialPosition: defaultPos,
    onDragEnd: handleDragEnd,
    disabled: !floating,
  });

  useEffect(() => {
    if (target === "header") {
      const raf = requestAnimationFrame(() => setHeaderVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setHeaderVisible(false);
  }, [target]);

  const handleUndock = useCallback(() => {
    setHeaderVisible(false);
    const timer = setTimeout(() => onUndockToFloating(), 280);
    return () => clearTimeout(timer);
  }, [onUndockToFloating]);

  const body = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--fintheon-accent)] font-semibold tracking-[0.14em] uppercase">
          PsychAssist
        </span>
        <div className="flex-1 min-w-0">
          <CompactERMonitor />
        </div>
      </div>
    );
  }, []);

  if (!floating) {
    return (
      <div
        className="flex items-center gap-2 bg-[var(--fintheon-bg)] rounded-lg px-3.5 h-7 overflow-hidden"
        style={{
          width: headerVisible ? 360 : 0,
          opacity: headerVisible ? 1 : 0,
          transition:
            "width 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease",
        }}
      >
        <button
          onClick={handleUndock}
          className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
          title="Picture-in-picture (float)"
        >
          <PictureInPicture2 className="w-3.5 h-3.5" />
        </button>
        <div className="min-w-[270px] max-w-[340px]">{body}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Hide"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-2xl px-3 py-2"
      style={{ top: 0, left: 0, width: "340px" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <button
            ref={gripRef}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors cursor-grab active:cursor-grabbing touch-none"
            title="Drag"
            aria-label="Drag PsychAssist"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            onClick={onDockToHeader}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Dock to header"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-[var(--fintheon-accent)]/70 tracking-[0.18em] uppercase">
            PsychAssist
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
            title="Hide"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div>{body}</div>
      <div className="mt-2 text-[10px] text-zinc-600">
        Drag into the header to fuse, or click the PiP icon.
      </div>
    </div>
  );
}
