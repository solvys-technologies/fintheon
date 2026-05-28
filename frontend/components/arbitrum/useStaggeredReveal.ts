// [Codex 2026-05-27] Shared Arbitrum staggered reveal timing.
import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function useStaggeredReveal(count: number, stepMs = 200): boolean[] {
  const [revealed, setRevealed] = useState<boolean[]>(() =>
    Array<boolean>(count).fill(prefersReducedMotion()),
  );

  useEffect(() => {
    if (count <= 0) {
      setRevealed([]);
      return;
    }
    const reduced = prefersReducedMotion();
    setRevealed(Array<boolean>(count).fill(reduced));
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setRevealed((prev) => {
            if (prev[i]) return prev;
            const next = prev.slice();
            next[i] = true;
            return next;
          });
        }, i * stepMs),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [count, stepMs]);

  return revealed;
}
