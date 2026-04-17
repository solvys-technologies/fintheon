// [claude-code 2026-04-16] Smooth roll-out transition for header dock/undock
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { GripVertical, PictureInPicture2, X } from "lucide-react";
import { CompactERMonitor } from "../mission-control/CompactERMonitor";

export type PsychAssistDockTarget = "floating" | "header";

interface PsychAssistDockableProps {
  target: PsychAssistDockTarget;
  onDockToHeader: () => void;
  onUndockToFloating: () => void;
  onClose?: () => void;
  storageKey?: string;
  headerDockZoneId?: string;
}

type Pos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function PsychAssistDockable({
  target,
  onDockToHeader,
  onUndockToFloating,
  onClose,
  storageKey = "fintheon:psychassist-floating-pos:v1",
  headerDockZoneId = "fintheon-heading-toolbar",
}: PsychAssistDockableProps) {
  const [pos, setPos] = useState<Pos>({ x: 24, y: 86 });
  const [dragging, setDragging] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const dragOffset = useRef<Pos>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Pos>;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos({ x: parsed.x, y: parsed.y });
          return;
        }
      }
    } catch {
      // ignore
    }

    // Sensible default near top-right but below header
    const x =
      typeof window !== "undefined"
        ? Math.max(24, window.innerWidth - 360)
        : 24;
    setPos({ x, y: 86 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [pos, storageKey]);

  // Animate header dock open on mount
  useEffect(() => {
    if (target === "header") {
      const raf = requestAnimationFrame(() => setHeaderVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setHeaderVisible(false);
  }, [target]);

  // Smooth undock: collapse first, then switch to floating
  const handleUndock = useCallback(() => {
    setHeaderVisible(false);
    const timer = setTimeout(() => onUndockToFloating(), 280);
    return () => clearTimeout(timer);
  }, [onUndockToFloating]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const next = {
        x: clamp(e.clientX - dragOffset.current.x, 8, vw - 260),
        y: clamp(e.clientY - dragOffset.current.y, 72, vh - 120),
      };
      setPos(next);
    };

    const handleUp = (e: MouseEvent) => {
      setDragging(false);
      const dockZone = document.getElementById(headerDockZoneId);
      if (!dockZone) return;
      const rect = dockZone.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside) onDockToHeader();
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, headerDockZoneId, onDockToHeader]);

  const floating = target === "floating";

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
      className="fixed z-50 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-2xl px-3 py-2"
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: "340px" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <button
            onMouseDown={(e) => {
              setDragging(true);
              dragOffset.current = { x: 14, y: 14 };
              e.preventDefault();
              e.stopPropagation();
            }}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors cursor-grab active:cursor-grabbing"
            title="Drag"
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
