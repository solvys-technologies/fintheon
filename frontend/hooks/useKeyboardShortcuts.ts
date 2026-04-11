// [claude-code 2026-04-10] S9-T3: Extracted keyboard shortcuts from MainLayout
import { useEffect } from "react";

interface KeyboardShortcutHandlers {
  navigateTab: (tab: string) => void;
  setShowSearchModal: (fn: (prev: boolean) => boolean) => void;
  setShowYouTubeMiniplayer: (fn: (prev: boolean) => boolean) => void;
  setNotificationCenterOpen: (fn: (prev: boolean) => boolean) => void;
  toggleManualDnd: () => void;
}

const TAB_MAP: Record<string, string> = {
  "1": "dashboard",
  "2": "analysis",
  "3": "riskflow",
  "4": "econ",
  "5": "performance",
  "6": "settings",
};

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+Shift+Y -> YouTube miniplayer
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "y" || e.key === "Y")
      ) {
        e.preventDefault();
        handlers.setShowYouTubeMiniplayer((v) => {
          const next = !v;
          try {
            localStorage.setItem("fintheon:yt-miniplayer-open", String(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        return;
      }
      // Cmd+K -> Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handlers.setShowSearchModal((v) => !v);
        return;
      }
      // Ctrl+Shift+D -> Toggle DND
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "d" || e.key === "D")
      ) {
        e.preventDefault();
        handlers.toggleManualDnd();
        return;
      }
      // Cmd+Shift+1-6 -> Tab navigation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && TAB_MAP[e.key]) {
        e.preventDefault();
        handlers.navigateTab(TAB_MAP[e.key]);
        return;
      }
      // Esc -> Close modals
      if (e.key === "Escape") {
        handlers.setShowSearchModal(() => false);
        handlers.setNotificationCenterOpen(() => false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
