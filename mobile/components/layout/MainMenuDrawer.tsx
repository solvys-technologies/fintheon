// [claude-code 2026-05-16] S67: Sanctum dropdown with Timeline + Arbitrum sub-items,
//   renamed Chat button, removed Apparatus, trimmed 10%, dark gray bg, rounded corners.

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Eye,
  Zap,
  Calendar,
  MessageCircle,
  Shield,
  HelpCircle,
  Sun,
  Moon,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSwipeGesture } from "../../hooks/useSwipeGesture";
import { useHaptic } from "../../hooks/useHaptic";

function ArbitrumGlyph({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        lineHeight: 1,
        fontFamily: "var(--font-display)",
        fontWeight: 500,
        color: "inherit",
      }}
    >
      <span style={{ fontSize: size * 0.72, lineHeight: 0.85 }}>+</span>
      <span style={{ fontSize: size * 0.72, lineHeight: 0.85 }}>−</span>
    </span>
  );
}

interface MainMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

const PRIMARY_NAV = [
  { id: "dashboard", label: "Desk", icon: LayoutDashboard },
  null as { id: "sanctum" } | null, // placeholder — rendered inline as dropdown
  { id: "riskflow", label: "RiskFlow", icon: Zap },
  { id: "calendar", label: "Econ", icon: Calendar },
  { id: "chat", label: "Chat", icon: MessageCircle },
] as const;

const FOOTER_NAV = [
  { id: "settings", label: "Settings & Privacy", icon: Shield },
  { id: "help", label: "Help Center", icon: HelpCircle },
] as const;

const DRAWER_WIDTH = "80vw";
const ITEM_HEIGHT = 42;
const ITEM_PADDING = "0 18px";
const ITEM_FONT_SIZE = 12;

function modeSegmentStyle(active: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 22,
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
  const [sanctumOpen, setSanctumOpen] = useState(false);

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
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
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
              background: "var(--surface, #0a0a0a)",
              display: "flex",
              flexDirection: "column",
              paddingTop: "env(safe-area-inset-top)",
              overflowY: "auto",
              pointerEvents: "auto",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 16px 10px" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
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
            <div style={{ padding: "6px 0" }}>
              {/* Dashboard */}
              <NavItem
                icon={LayoutDashboard}
                label="Desk"
                onClick={() => {
                  vibrate(6);
                  onNavigate("dashboard");
                  onClose();
                }}
              />

              {/* Sanctum dropdown */}
              <div>
                <button
                  onClick={() => {
                    vibrate(6);
                    setSanctumOpen((v) => !v);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    height: ITEM_HEIGHT,
                    padding: ITEM_PADDING,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    fontFamily: "var(--font-data)",
                    fontSize: ITEM_FONT_SIZE,
                    color: "var(--text-primary, #f0ead6)",
                    letterSpacing: "0.03em",
                  }}
                >
                  <Eye
                    size={16}
                    strokeWidth={1.5}
                    color="var(--text-secondary)"
                  />
                  <span style={{ flex: 1, textAlign: "left" }}>Sanctum</span>
                  <motion.span
                    animate={{ rotate: sanctumOpen ? 0 : -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      color="var(--text-secondary)"
                    />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {sanctumOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ overflow: "hidden" }}
                    >
                      {/* Timeline sub-item */}
                      <button
                        onClick={() => {
                          vibrate(6);
                          onNavigate("timeline");
                          onClose();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          width: "100%",
                          height: ITEM_HEIGHT,
                          padding: "0 18px 0 50px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                          fontFamily: "var(--font-data)",
                          fontSize: ITEM_FONT_SIZE - 1,
                          color: "var(--text-secondary)",
                          letterSpacing: "0.03em",
                        }}
                      >
                        <Clock
                          size={14}
                          strokeWidth={1.5}
                          color="var(--text-secondary)"
                        />
                        Timeline
                      </button>

                      {/* Arbitrum sub-item */}
                      <button
                        onClick={() => {
                          vibrate(6);
                          onNavigate("arbitrum");
                          onClose();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          width: "100%",
                          height: ITEM_HEIGHT,
                          padding: "0 18px 0 50px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                          fontFamily: "var(--font-data)",
                          fontSize: ITEM_FONT_SIZE - 1,
                          color: "var(--text-secondary)",
                          letterSpacing: "0.03em",
                        }}
                      >
                        <ArbitrumGlyph size={14} />
                        Arbitrum
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RiskFlow */}
              <NavItem
                icon={Zap}
                label="RiskFlow"
                onClick={() => {
                  vibrate(6);
                  onNavigate("riskflow");
                  onClose();
                }}
              />

              {/* Calendar */}
              <NavItem
                icon={Calendar}
                label="Econ"
                onClick={() => {
                  vibrate(6);
                  onNavigate("calendar");
                  onClose();
                }}
              />

              {/* Chat */}
              <NavItem
                icon={MessageCircle}
                label="Chat"
                onClick={() => {
                  vibrate(6);
                  onNavigate("chat");
                  onClose();
                }}
              />
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
            <div style={{ padding: "6px 0" }}>
              {FOOTER_NAV.map((item) => {
                const Icon = item.icon;
                const isHelp = item.id === "help";
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isHelp) {
                        window.open(
                          "https://docs.pricedinresearch.io/fintheon",
                          "_blank",
                        );
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
                      height: ITEM_HEIGHT,
                      padding: ITEM_PADDING,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      fontFamily: "var(--font-data)",
                      fontSize: ITEM_FONT_SIZE,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Icon
                      size={16}
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
                height: ITEM_HEIGHT,
                padding: ITEM_PADDING,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
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
                  <Sun size={13} strokeWidth={1.8} />
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
                  <Moon size={13} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Session */}
            <div
              style={{
                padding: ITEM_PADDING,
                height: ITEM_HEIGHT,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.03em",
                }}
              >
                {user?.email || "\u2014"}
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: ITEM_HEIGHT,
                padding: ITEM_PADDING,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                fontFamily: "var(--font-data)",
                fontSize: 11,
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

function NavItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    color?: string;
  }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        height: ITEM_HEIGHT,
        padding: ITEM_PADDING,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        fontFamily: "var(--font-data)",
        fontSize: ITEM_FONT_SIZE,
        color: "var(--text-primary, #f0ead6)",
        letterSpacing: "0.03em",
      }}
    >
      <Icon size={16} strokeWidth={1.5} color="var(--text-secondary)" />
      {label}
    </button>
  );
}
