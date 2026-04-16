// [claude-code 2026-04-16] Fix scroll-lock: main uses height:100% so inner snap containers own the scroll
// [claude-code 2026-04-15] S18: Root layout — toolbar + content area + floating chat FAB (no bottom tab bar)
import { useRef, useCallback, type ReactNode } from "react";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useVixTicker } from "../../hooks/useVixTicker";
import { MobileToolbar } from "./MobileToolbar";
import { HamburgerMenu } from "./HamburgerMenu";
import { FloatingChatButton } from "./FloatingChatButton";
import { useState } from "react";

interface MobileShellProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  chatOpen: boolean;
  onChatToggle: () => void;
  children: ReactNode;
}

const TOOLBAR_HEIGHT = 92; // 48px bar + 44px chevron
const TAB_COUNT = 5;

export function MobileShell({
  activeTab,
  onTabChange,
  chatOpen,
  onChatToggle,
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
          overflow: "hidden",
          paddingTop: `calc(env(safe-area-inset-top) + ${TOOLBAR_HEIGHT}px)`,
          paddingBottom: `calc(env(safe-area-inset-bottom) + 24px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>

      {!chatOpen && activeTab !== 2 && (
        <FloatingChatButton onTap={onChatToggle} />
      )}
      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={activeTab}
        onNavigate={onTabChange}
      />
    </div>
  );
}
