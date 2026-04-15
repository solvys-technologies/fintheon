// [claude-code 2026-04-15] T3: Generic touch swipe detection hook
import { useEffect, type RefObject } from "react";

interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

const MIN_DISTANCE = 50;
const MIN_VELOCITY = 0.3; // px/ms

export function useSwipeGesture(
  ref: RefObject<HTMLElement | null>,
  callbacks: SwipeCallbacks,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;
      if (dt === 0) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const isHorizontal = absDx > absDy;
      const distance = isHorizontal ? absDx : absDy;
      const velocity = distance / dt;

      if (distance < MIN_DISTANCE || velocity < MIN_VELOCITY) return;

      if (isHorizontal) {
        if (dx < 0) callbacks.onSwipeLeft?.();
        else callbacks.onSwipeRight?.();
      } else {
        if (dy < 0) callbacks.onSwipeUp?.();
        else callbacks.onSwipeDown?.();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, callbacks]);
}
