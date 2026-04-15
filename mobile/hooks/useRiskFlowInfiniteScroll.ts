// [claude-code 2026-04-15] T5: Infinite scroll via IntersectionObserver — root MUST be scroll container ref
import { useEffect, useRef } from "react";

interface UseRiskFlowInfiniteScrollOptions {
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

export function useRiskFlowInfiniteScroll({
  hasMore,
  loadingMore,
  loadMore,
}: UseRiskFlowInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  return { sentinelRef, scrollContainerRef };
}
