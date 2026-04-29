// [claude-code 2026-04-28] S48-T3: Floating drag hook for CountdownFuse floating mode.
// DragElastic 0.08 matches PsychAssist fluidity. Position persists to localStorage.
import { useState, useRef, useCallback } from "react";

const POS_KEY = "fintheon:countdown-position";

interface Position {
  x: number;
  y: number;
}

function loadPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Position;
  } catch {
    return null;
  }
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    /* silent */
  }
}

export function useFloatingDrag(floating: boolean) {
  const [pos, setPos] = useState<Position | null>(() => loadPosition());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!floating) return;
      e.preventDefault();
      const current = pos ?? { x: 0, y: 0 };
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: current.x,
        posY: current.y,
      };
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [floating, pos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.posX + dx * 0.08,
        y: dragRef.current.posY + dy * 0.08,
      });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragRef.current = null;
    setPos((prev) => {
      if (prev) savePosition(prev);
      return prev;
    });
  }, [dragging]);

  const redock = useCallback(() => {
    setPos(null);
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* silent */
    }
  }, []);

  return {
    pos,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    redock,
  };
}
