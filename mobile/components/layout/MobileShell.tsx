// [claude-code 2026-04-16] Shell — toolbar + bulletin FAB with glow reminder + chat FAB status
import {
  useRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Newspaper, ShieldCheck } from "lucide-react";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useVixTicker } from "../../hooks/useVixTicker";
import { useHaptic } from "../../hooks/useHaptic";
import { useSettings } from "../../contexts/SettingsContext";
import { useRoutineApprovals } from "../../hooks/useRoutineApprovals";
import { MobileToolbar } from "./MobileToolbar";
import { HamburgerMenu } from "./HamburgerMenu";
import { FloatingChatButton } from "./FloatingChatButton";
import { MobileBulletin } from "../bulletin/MobileBulletin";
import { RoutineApprovalCard } from "../routines/RoutineApprovalCard";

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
  const [bulletinGlow, setBulletinGlow] = useState(true);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const vibrate = useHaptic();
  const { settings } = useSettings();
  const { pendingCount: pendingApprovals } = useRoutineApprovals();

  useVixTicker();

  // Bulletin glow: "once" dismisses on first render, "until-pressed" stays until tapped
  useEffect(() => {
    if (settings.bulletinReminder === "once") {
      const key = "fintheon-mobile:bulletin-glow-dismissed";
      if (localStorage.getItem(key)) {
        setBulletinGlow(false);
      } else {
        localStorage.setItem(key, "1");
        const t = setTimeout(() => setBulletinGlow(false), 4000);
        return () => clearTimeout(t);
      }
    }
  }, [settings.bulletinReminder]);

  const handleSwipeLeft = useCallback(() => {
    if (activeTab < TAB_COUNT - 1) {
      vibrate(10);
      onTabChange(activeTab + 1);
    }
  }, [activeTab, onTabChange, vibrate]);

  const handleSwipeRight = useCallback(() => {
    if (activeTab > 0) {
      vibrate(10);
      onTabChange(activeTab - 1);
    }
  }, [activeTab, onTabChange, vibrate]);

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
          {/* Bulletin FAB with glow reminder */}
          <button
            onClick={() => {
              vibrate(10);
              setBulletinGlow(false);
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
              boxShadow: bulletinGlow
                ? "0 0 12px 3px rgba(199, 159, 74, 0.45), 0 0 4px 1px rgba(199, 159, 74, 0.25)"
                : "none",
              animation: bulletinGlow
                ? "bulletin-glow 2s ease-in-out infinite"
                : "none",
              transition: "box-shadow 0.6s ease-out",
            }}
          >
            <Newspaper
              size={18}
              color={bulletinGlow ? "var(--accent)" : "var(--text-secondary)"}
              style={{ transition: "color 0.4s ease-out" }}
            />
          </button>
          {bulletinGlow && (
            <style>{`@keyframes bulletin-glow {
              0%, 100% { box-shadow: 0 0 12px 3px rgba(199,159,74,0.45), 0 0 4px 1px rgba(199,159,74,0.25); }
              50% { box-shadow: 0 0 18px 5px rgba(199,159,74,0.6), 0 0 6px 2px rgba(199,159,74,0.35); }
            }`}</style>
          )}

          {/* Routine approval FAB — glows when Superadmin sign-off is pending */}
          {pendingApprovals > 0 && (
            <button
              onClick={() => {
                vibrate(10);
                setApprovalsOpen(true);
              }}
              aria-label={`${pendingApprovals} routine approval${pendingApprovals === 1 ? "" : "s"} pending`}
              style={{
                position: "fixed",
                bottom: "calc(140px + env(safe-area-inset-bottom))",
                right: 20,
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--surface-raised, #1a1a1a)",
                border: "1px solid var(--accent, #c79f4a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 30,
                WebkitTapHighlightColor: "transparent",
                boxShadow:
                  "0 0 12px 3px rgba(199, 159, 74, 0.45), 0 0 4px 1px rgba(199, 159, 74, 0.25)",
                animation: "bulletin-glow 2s ease-in-out infinite",
              }}
            >
              <ShieldCheck size={18} color="var(--accent)" />
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "var(--accent, #c79f4a)",
                  color: "var(--black, #050402)",
                  fontSize: 10,
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {pendingApprovals > 9 ? "9+" : pendingApprovals}
              </span>
            </button>
          )}

          {/* Chat FAB */}
          <FloatingChatButton onTap={onChatToggle} />
        </>
      )}

      {/* Bulletin widget */}
      <MobileBulletin
        isOpen={bulletinOpen}
        onClose={() => setBulletinOpen(false)}
      />

      {/* Routine approvals sheet */}
      <RoutineApprovalCard
        isOpen={approvalsOpen}
        onClose={() => setApprovalsOpen(false)}
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
