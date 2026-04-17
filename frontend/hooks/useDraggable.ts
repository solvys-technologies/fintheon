// [claude-code 2026-04-17] useDraggable: Pointer Events + rAF + transform3d; strict grip-only; kills sticky-cursor and friction by construction
import { useEffect, useRef, useCallback, useState } from "react";

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

function clampToViewport(
  x: number,
  y: number,
  el: HTMLElement | null,
): { x: number; y: number } {
  if (!el) return { x, y };
  const rect = el.getBoundingClientRect();
  const maxX = Math.max(0, window.innerWidth - rect.width);
  const maxY = Math.max(0, window.innerHeight - rect.height);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
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
    const el = elementRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
  }, [elementRef, position]);

  const writeTransform = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [elementRef]);

  const flushFrame = useCallback(() => {
    rafPendingRef.current = false;
    if (!isDraggingRef.current) return;
    const el = elementRef.current;
    if (!el) return;

    const rawX = latestClientRef.current.x - startOffsetRef.current.x;
    const rawY = latestClientRef.current.y - startOffsetRef.current.y;
    const clamped =
      bounds === "viewport"
        ? clampToViewport(rawX, rawY, el)
        : { x: rawX, y: rawY };

    posRef.current = clamped;
    writeTransform();
  }, [elementRef, bounds, writeTransform]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled) return;
      if (e.button !== 0) return; // primary button only

      const handle = handleRef.current;
      const el = elementRef.current;
      if (!handle || !el) return;

      // Capture pointer so we get move/up even if cursor leaves the element
      try {
        handle.setPointerCapture(e.pointerId);
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

      el.style.willChange = "transform";
      setIsDragging(true);
      onDragStart?.();
      e.preventDefault();
      e.stopPropagation();
    },
    [disabled, handleRef, elementRef, onDragStart],
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

      const handle = handleRef.current;
      const el = elementRef.current;
      if (handle && activePointerIdRef.current !== null) {
        try {
          handle.releasePointerCapture(activePointerIdRef.current);
        } catch {
          /* ignore */
        }
      }

      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      rafPendingRef.current = false;

      if (el) el.style.willChange = "";

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
    [handleRef, elementRef, storageKey, onDragEnd],
  );

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || disabled) return;

    handle.addEventListener("pointerdown", handlePointerDown);
    // Attach move/up to the HANDLE (because we setPointerCapture on it) —
    // captured pointer routes move/up events through the capturing element.
    handle.addEventListener("pointermove", handlePointerMove);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    return () => {
      handle.removeEventListener("pointerdown", handlePointerDown);
      handle.removeEventListener("pointermove", handlePointerMove);
      handle.removeEventListener("pointerup", endDrag);
      handle.removeEventListener("pointercancel", endDrag);

      // Force-reset refs on unmount — kills sticky-cursor if component unmounts mid-drag
      if (activePointerIdRef.current !== null) {
        try {
          handle.releasePointerCapture(activePointerIdRef.current);
        } catch {
          /* ignore */
        }
      }
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      rafPendingRef.current = false;
      const el = elementRef.current;
      if (el) el.style.willChange = "";
    };
  }, [
    handleRef,
    elementRef,
    disabled,
    handlePointerDown,
    handlePointerMove,
    endDrag,
  ]);

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
