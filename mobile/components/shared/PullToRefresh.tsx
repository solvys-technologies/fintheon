// [claude-code 2026-04-15] T5: Pull-to-refresh gesture wrapper — segmented bar fills on pull, triggers refresh
import { type ReactNode, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SegmentedBar } from "./SegmentedBar";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const PULL_THRESHOLD = 80;

export function PullToRefresh({
  children,
  onRefresh,
  scrollRef,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

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
        setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD * 1.5));
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
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const progress = refreshing
    ? 100
    : Math.min((pullDistance / PULL_THRESHOLD) * 100, 100);
  const showBar = pullDistance > 10 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence>
        {showBar && (
          <motion.div
            className="px-4 pt-2 pb-1"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
          >
            <SegmentedBar value={progress} size="compact" />
            {refreshing && (
              <span
                className="block text-center mt-1"
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  color: "var(--text-secondary)",
                }}
              >
                [REFRESHING...]
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
