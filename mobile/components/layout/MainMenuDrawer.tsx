// [claude-code 2026-05-01] S56 Track D: Twitter-style left drawer replacing
//   the bottom-up HamburgerMenu sheet. Slides content right 80vw with scrim.
//   Flat --fintheon-bg surface, no gradients/Kanban borders. Framer-motion
//   transformX 250ms ease-in-out.
import { useState, useCallback } from "react";
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
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";

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
  const { settings } = useSettings();
  const traderName = settings.traderName || "T.P.";
  const handle = `@${(settings.traderName || "tp").toLowerCase().replace(/\s+/g, "")}`;

  const handleSignOut = useCallback(async () => {
    await signOut();
    onClose();
  }, [signOut, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          {/* Scrim — only over the 20vw peek strip right of drawer, tap to close */}
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
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />

          {/* Drawer */}
          <motion.div
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
            {/* Header — profile area */}
            <div style={{ padding: "20px 16px 12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                {/* Target glyph */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "2px solid var(--accent, #c79f4a)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--accent, #c79f4a)",
                    }}
                  />
                </div>

                <button
                  onClick={() => onNavigate("add")}
                  aria-label="Add person"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 6,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <UserPlus size={18} color="var(--accent, #c79f4a)" />
                </button>
              </div>

              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary, #f0ead6)",
                  marginTop: 8,
                }}
              >
                {traderName}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                {handle}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 8,
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                }}
              >
                <span style={{ color: "var(--text-primary, #f0ead6)" }}>
                  <strong>144</strong>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>
                    Following
                  </span>
                </span>
                <span style={{ color: "var(--text-primary, #f0ead6)" }}>
                  <strong>40</strong>{" "}
                  <span style={{ color: "var(--text-secondary)" }}>
                    Followers
                  </span>
                </span>
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
                return (
                  <button
                    key={item.id}
                    onClick={() => {
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
                  onClick={() => setMode("light")}
                  style={modeSegmentStyle(mode === "light")}
                >
                  <Sun size={14} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "dark"}
                  onClick={() => setMode("dark")}
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
