// [claude-code 2026-04-15] T3: Root layout — toolbar + content area + bottom tab bar
import { useRef, useCallback, type ReactNode } from "react";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useVixTicker } from "../../hooks/useVixTicker";
import { MobileToolbar } from "./MobileToolbar";
import { BottomTabBar } from "./BottomTabBar";
import { HamburgerMenu } from "./HamburgerMenu";
import { useState } from "react";

interface MobileShellProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  children: ReactNode;
}

const TOOLBAR_HEIGHT = 92; // 48px bar + 44px chevron
const TAB_BAR_HEIGHT = 56;
const TAB_COUNT = 4;

export function MobileShell({
  activeTab,
  onTabChange,
  children,
}: MobileShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Initialize VIX polling at shell level
  useVixTicker();

  const handleSwipeLeft = useCallback(() => {
    if (activeTab < TAB_COUNT - 1) {
      navigator.vibrate?.(10);
      onTabChange(activeTab + 1);
    }
  }, [activeTab, onTabChange]);

  const handleSwipeRight = useCallback(() => {
    if (activeTab > 0) {
      navigator.vibrate?.(10);
      onTabChange(activeTab - 1);
    }
  }, [activeTab, onTabChange]);

  useSwipeGesture(contentRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--black)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MobileToolbar onHamburgerTap={() => setMenuOpen(true)} />

      <main
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: "auto",
          paddingTop: `calc(env(safe-area-inset-top) + ${TOOLBAR_HEIGHT}px)`,
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${TAB_BAR_HEIGHT}px)`,
        }}
      >
        {children}
      </main>

      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
      <HamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
