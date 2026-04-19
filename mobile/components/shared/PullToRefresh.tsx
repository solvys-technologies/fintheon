// [claude-code 2026-04-19] S26-P1 T7: pull-to-refresh haptics upgraded —
//   `haptic.tap()` when the threshold is armed, `haptic.success()` when onRefresh
//   resolves. Previously fired a single vibration on arm.
// [claude-code 2026-04-16] Pull-to-refresh — haptic-gated vibration
import { type ReactNode, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "../../lib/haptics";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const PULL_THRESHOLD = 50;

export function PullToRefresh({
  children,
  onRefresh,
  scrollRef,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
        armed.current = false;
      }
    },
    [scrollRef],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        const next = Math.min(delta * 0.7, PULL_THRESHOLD * 1.5);
        setPullDistance(next);
        // Buzz once the refresh threshold is crossed, not every frame.
        if (!armed.current && next >= PULL_THRESHOLD) {
          armed.current = true;
          haptic.tap();
        }
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
        haptic.success();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
        armed.current = false;
      }
    } else {
      setPullDistance(0);
      armed.current = false;
    }
  }, [pullDistance, refreshing, onRefresh]);

  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 40 }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid var(--text-display)",
                animation: refreshing
                  ? "ptr-spin 1.2s linear infinite"
                  : "none",
                opacity: refreshing
                  ? 1
                  : Math.min(pullDistance / PULL_THRESHOLD, 1),
                transition: "opacity 100ms ease-out",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
      {children}
    </div>
  );
}
