// [claude-code 2026-04-16] Pull-to-refresh — haptic-gated vibration
import { type ReactNode, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptic } from "../../hooks/useHaptic";

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
  const vibrate = useHaptic();

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [scrollRef],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.7, PULL_THRESHOLD * 1.5));
      }
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      vibrate(15);
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh, vibrate]);

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
