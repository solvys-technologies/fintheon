// [claude-code 2026-04-18] Fix Bulletin drag — listeners now re-attach when refs populate after a portal/conditional mount; clampToViewport now anchor-aware (works for top/right/bottom-anchored panels, not just top-left)
// [claude-code 2026-04-17] useDraggable: Pointer Events + rAF + transform3d; strict grip-only; kills sticky-cursor and friction by construction
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
} from "react";

export interface UseDraggableOptions {
  elementRef: React.RefObject<HTMLElement | null>;
  handleRef: React.RefObject<HTMLElement | null>;
  storageKey?: string;
  bounds?: "viewport" | "none";
  initialPosition?: { x: number; y: number };
  onDragStart?: () => void;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  disabled?: boolean;
}

export interface UseDraggableResult {
  position: { x: number; y: number };
  isDragging: boolean;
  reset: () => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

function readStoredPosition(
  key: string | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

// Anchor-aware viewport clamp: pivot off the element's *current* visual rect
// rather than assuming (x, y) is the absolute top-left. Works for panels
// positioned via top/right (Bulletin), top/left (DraggablePanel), or any
// combination — the transform delta is converted into a visual-rect delta,
// clamped against the viewport, then converted back.
function clampToViewport(
  targetX: number,
  targetY: number,
  el: HTMLElement | null,
  currentX: number,
  currentY: number,
): { x: number; y: number } {
  if (!el) return { x: targetX, y: targetY };
  const rect = el.getBoundingClientRect();
  const deltaX = targetX - currentX;
  const deltaY = targetY - currentY;
  const newLeft = rect.left + deltaX;
  const newTop = rect.top + deltaY;
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);
  const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
  const clampedTop = Math.max(0, Math.min(newTop, maxTop));
  return {
    x: currentX + (clampedLeft - rect.left),
    y: currentY + (clampedTop - rect.top),
  };
}

export function useDraggable(options: UseDraggableOptions): UseDraggableResult {
  const {
    elementRef,
    handleRef,
    storageKey,
    bounds = "viewport",
    initialPosition = { x: 0, y: 0 },
    onDragStart,
    onDragEnd,
    disabled = false,
  } = options;

  const [position, setPositionState] = useState(() =>
    readStoredPosition(storageKey, initialPosition),
  );
  const [isDragging, setIsDragging] = useState(false);

  // Mirror handleRef/elementRef into state so the listener-attachment effect
  // re-runs once the consumer's portal/conditional JSX commits and the refs
  // populate. RefObject mutations alone don't trigger effect re-runs, which
  // caused the Bulletin to never get pointer listeners (refs were null on the
  // render where useDraggable's effect first fired with disabled=false).
  const [handleEl, setHandleEl] = useState<HTMLElement | null>(null);
  const [dragEl, setDragEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (handleRef.current !== handleEl) setHandleEl(handleRef.current);
    if (elementRef.current !== dragEl) setDragEl(elementRef.current);
  });

  const posRef = useRef(position);
  const latestClientRef = useRef({ x: 0, y: 0 });
  const startOffsetRef = useRef({ x: 0, y: 0 });
  const rafPendingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  // Keep posRef in sync with state (for external setPosition calls)
  useEffect(() => {
    posRef.current = position;
  }, [position]);

  // Apply transform on mount / when position changes externally
  useEffect(() => {
    if (!dragEl) return;
    dragEl.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
  }, [dragEl, position]);

  const writeTransform = useCallback(() => {
    if (!dragEl) return;
    const { x, y } = posRef.current;
    dragEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [dragEl]);

  const flushFrame = useCallback(() => {
    rafPendingRef.current = false;
    if (!isDraggingRef.current) return;
    if (!dragEl) return;

    const rawX = latestClientRef.current.x - startOffsetRef.current.x;
    const rawY = latestClientRef.current.y - startOffsetRef.current.y;
    const clamped =
      bounds === "viewport"
        ? clampToViewport(rawX, rawY, dragEl, posRef.current.x, posRef.current.y)
        : { x: rawX, y: rawY };

    posRef.current = clamped;
    writeTransform();
  }, [dragEl, bounds, writeTransform]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled) return;
      if (e.button !== 0) return; // primary button only

      if (!handleEl || !dragEl) return;

      // Capture pointer so we get move/up even if cursor leaves the element
      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      activePointerIdRef.current = e.pointerId;
      isDraggingRef.current = true;
      startOffsetRef.current = {
        x: e.clientX - posRef.current.x,
        y: e.clientY - posRef.current.y,
      };
      latestClientRef.current = { x: e.clientX, y: e.clientY };

      dragEl.style.willChange = "transform";
      setIsDragging(true);
      onDragStart?.();
      e.preventDefault();
      e.stopPropagation();
    },
    [disabled, handleEl, dragEl, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current !== e.pointerId) return;
      latestClientRef.current = { x: e.clientX, y: e.clientY };
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(flushFrame);
      }
    },
    [flushFrame],
  );

  const endDrag = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (
        activePointerIdRef.current !== null &&
        activePointerIdRef.current !== e.pointerId
      ) {
        return;
      }

      if (handleEl && activePointerIdRef.current !== null) {
        try {
          handleEl.releasePointerCapture(activePointerIdRef.current);
        } catch {
          /* ignore */
        }
      }

      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      rafPendingRef.current = false;

      if (dragEl) dragEl.style.willChange = "";

      const finalPos = posRef.current;
      setPositionState(finalPos);
      setIsDragging(false);

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(finalPos));
        } catch {
          /* ignore */
        }
      }

      onDragEnd?.(finalPos);
    },
    [handleEl, dragEl, storageKey, onDragEnd],
  );

  useEffect(() => {
    if (!handleEl || disabled) return;

    handleEl.addEventListener("pointerdown", handlePointerDown);
    // Attach move/up to the HANDLE (because we setPointerCapture on it) —
    // captured pointer routes move/up events through the capturing element.
    handleEl.addEventListener("pointermove", handlePointerMove);
    handleEl.addEventListener("pointerup", endDrag);
    handleEl.addEventListener("pointercancel", endDrag);

    return () => {
      handleEl.removeEventListener("pointerdown", handlePointerDown);
      handleEl.removeEventListener("pointermove", handlePointerMove);
      handleEl.removeEventListener("pointerup", endDrag);
      handleEl.removeEventListener("pointercancel", endDrag);

      // Force-reset refs on unmount — kills sticky-cursor if component unmounts mid-drag
      if (activePointerIdRef.current !== null) {
        try {
          handleEl.releasePointerCapture(activePointerIdRef.current);
        } catch {
          /* ignore */
        }
      }
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      rafPendingRef.current = false;
      if (dragEl) dragEl.style.willChange = "";
    };
  }, [handleEl, dragEl, disabled, handlePointerDown, handlePointerMove, endDrag]);

  const reset = useCallback(() => {
    const next = initialPosition;
    posRef.current = next;
    setPositionState(next);
    writeTransform();
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [initialPosition, storageKey, writeTransform]);

  const setPositionExternal = useCallback(
    (pos: { x: number; y: number }) => {
      posRef.current = pos;
      setPositionState(pos);
      writeTransform();
    },
    [writeTransform],
  );

  return {
    position,
    isDragging,
    reset,
    setPosition: setPositionExternal,
  };
}
