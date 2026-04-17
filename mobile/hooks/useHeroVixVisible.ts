// [claude-code 2026-04-17] Shared visibility flag for the Dash hero VIX tile —
// toolbar VIX fades in when the hero is scrolled off-screen.
import { useEffect } from "react";
import { create } from "zustand";

interface HeroVixVisibleState {
  visible: boolean;
  setVisible: (v: boolean) => void;
}

export const useHeroVixVisibleStore = create<HeroVixVisibleState>((set) => ({
  visible: true,
  setVisible: (v) => set({ visible: v }),
}));

export function useObserveHeroVixVisibility(
  target: React.RefObject<HTMLElement | null>,
  root?: React.RefObject<HTMLElement | null>,
) {
  const setVisible = useHeroVixVisibleStore((s) => s.setVisible);

  useEffect(() => {
    const el = target.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && entry.intersectionRatio > 0.3);
      },
      {
        root: root?.current ?? null,
        threshold: [0, 0.3, 0.6, 1],
      },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      // When leaving Dash, clear the flag so toolbar VIX is visible on other tabs
      setVisible(false);
    };
  }, [target, root, setVisible]);
}
