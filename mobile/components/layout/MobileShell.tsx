// [claude-code 2026-04-16] Shell — toolbar + bulletin FAB above chat FAB, no chevron
import { useRef, useCallback, type ReactNode } from "react";
import { useState } from "react";
import { Newspaper } from "lucide-react";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useVixTicker } from "../../hooks/useVixTicker";
import { MobileToolbar } from "./MobileToolbar";
import { HamburgerMenu } from "./HamburgerMenu";
import { FloatingChatButton } from "./FloatingChatButton";
import { MobileBulletin } from "../bulletin/MobileBulletin";

interface MobileShellProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  chatOpen: boolean;
  onChatToggle: () => void;
  children: ReactNode;
}

const TOOLBAR_HEIGHT = 48; // just the bar, no chevron
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
  const [bulletinOpen, setBulletinOpen] = useState(false);

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
      <MobileToolbar
        onHamburgerTap={() => setMenuOpen(true)}
        menuOpen={menuOpen}
      />

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

      {/* Floating buttons — bulletin above chat */}
      {!chatOpen && activeTab !== 2 && (
        <>
          {/* Bulletin FAB */}
          <button
            onClick={() => {
              navigator.vibrate?.(10);
              setBulletinOpen(true);
            }}
            aria-label="Open bulletin"
            style={{
              position: "fixed",
              bottom: "calc(88px + env(safe-area-inset-bottom))",
              right: 20,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--surface-raised, #1a1a1a)",
              border: "1px solid var(--border-visible)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 30,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Newspaper size={18} color="var(--text-secondary)" />
          </button>

          {/* Chat FAB */}
          <FloatingChatButton onTap={onChatToggle} />
        </>
      )}

      {/* Bulletin widget */}
      <MobileBulletin
        isOpen={bulletinOpen}
        onClose={() => setBulletinOpen(false)}
      />

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeTab={activeTab}
        onNavigate={onTabChange}
      />
    </div>
  );
}
