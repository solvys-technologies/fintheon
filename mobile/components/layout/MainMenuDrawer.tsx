// [claude-code 2026-05-16] Stripped profile cruft — app name, no following/followers/@/pic
import { useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Eye,
  Zap,
  Calendar,
  TrendingUp,
  Wrench,
  MessageCircle,
  Shield,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useHaptic } from "../../hooks/useHaptic";

interface MainMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

const PRIMARY_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sanctum", label: "Sanctum", icon: Eye },
  { id: "riskflow", label: "RiskFlow", icon: Zap },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "apparatus", label: "Apparatus", icon: Wrench },
] as const;

const FOOTER_NAV = [
  { id: "chat", label: "Open Harper Chat", icon: MessageCircle },
  { id: "settings", label: "Settings & Privacy", icon: Shield },
  { id: "help", label: "Help Center", icon: HelpCircle },
] as const;

const DRAWER_WIDTH = "80vw";

function modeSegmentStyle(active: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--black, #000)" : "var(--text-secondary)",
    border: "none",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition: "background 180ms ease, color 180ms ease",
  };
}

export function MainMenuDrawer({
  open,
  onClose,
  onNavigate,
}: MainMenuDrawerProps) {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const vibrate = useHaptic();
  const drawerRef = useRef<HTMLDivElement>(null);
  const handleSignOut = useCallback(async () => {
    vibrate(10);
    await signOut();
    onClose();
  }, [signOut, onClose, vibrate]);

  const handleHelpCenter = useCallback(() => {
    vibrate(6);
    window.open("https://docs.pricedinresearch.io/fintheon", "_blank");
    onClose();
  }, [onClose, vibrate]);

  useSwipeGesture(drawerRef, {
    onSwipeLeft: onClose,
  });

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          {/* Scrim — tap to close, no blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: DRAWER_WIDTH,
              background: "rgba(0,0,0,0.45)",
            }}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: `-${DRAWER_WIDTH}` }}
            animate={{ x: 0 }}
            exit={{ x: `-${DRAWER_WIDTH}` }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: DRAWER_WIDTH,
              background: "var(--black, #050402)",
              display: "flex",
              flexDirection: "column",
              paddingTop: "env(safe-area-inset-top)",
              overflowY: "auto",
            }}
          >
            {/* Header — app name branding */}
            <div style={{ padding: "20px 16px 12px" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--accent)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Fintheon
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: "0 16px",
                background:
                  "color-mix(in srgb, var(--accent, #c79f4a) 15%, transparent)",
              }}
            />

            {/* Primary nav */}
            <div style={{ padding: "8px 0" }}>
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      vibrate(6);
                      onNavigate(item.id);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                      height: 48,
                      padding: "0 20px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "var(--font-data)",
                      fontSize: 13,
                      color: "var(--text-primary, #f0ead6)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      color="var(--text-secondary)"
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: "4px 16px",
                background:
                  "color-mix(in srgb, var(--accent, #c79f4a) 15%, transparent)",
              }}
            />

            {/* Footer nav */}
            <div style={{ padding: "8px 0" }}>
              {FOOTER_NAV.map((item) => {
                const Icon = item.icon;
                const isHelp = item.id === "help";
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isHelp) {
                        window.open("https://docs.pricedinresearch.io/fintheon", "_blank");
                      } else {
                        onNavigate(item.id);
                      }
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      width: "100%",
                      height: 48,
                      padding: "0 20px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "var(--font-data)",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      color="var(--text-secondary)"
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: "4px 16px",
                background:
                  "color-mix(in srgb, var(--accent, #c79f4a) 15%, transparent)",
              }}
            />

            {/* Light/Dark toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 48,
                padding: "0 20px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                [MODE]
              </span>
              <div
                role="tablist"
                aria-label="Theme mode"
                style={{
                  display: "inline-flex",
                  gap: 4,
                  padding: 3,
                  background:
                    "color-mix(in srgb, var(--accent) 5%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--accent) 16%, transparent)",
                  borderRadius: 999,
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "light"}
                  onClick={() => {
                    vibrate(6);
                    setMode("light");
                  }}
                  style={modeSegmentStyle(mode === "light")}
                >
                  <Sun size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "dark"}
                  onClick={() => {
                    vibrate(6);
                    setMode("dark");
                  }}
                  style={modeSegmentStyle(mode === "dark")}
                >
                  <Moon size={14} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Session */}
            <div
              style={{
                padding: "0 20px",
                height: 48,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.03em",
                }}
              >
                {user?.email || "—"}
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: 48,
                padding: "0 20px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--error, #ef4444)",
              }}
            >
              [SIGN OUT]
            </button>

            {/* Safe area bottom */}
            <div
              style={{
                height: "env(safe-area-inset-bottom)",
                minHeight: 16,
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
