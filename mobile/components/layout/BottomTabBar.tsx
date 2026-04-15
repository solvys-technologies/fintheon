// [claude-code 2026-04-15] T3: Nothing-style bottom tab bar — Space Mono ALL CAPS, gold underline indicator
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Newspaper,
  MessageSquare,
  Settings,
} from "lucide-react";

export const TAB_CONFIG = [
  { label: "HOME", icon: LayoutDashboard },
  { label: "RISKFLOW", icon: Newspaper },
  { label: "CHAT", icon: MessageSquare },
  { label: "SETTINGS", icon: Settings },
] as const;

interface BottomTabBarProps {
  activeTab: number;
  onTabChange: (index: number) => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
    >
      {TAB_CONFIG.map((tab, i) => {
        const Icon = tab.icon;
        const active = activeTab === i;
        return (
          <button
            key={tab.label}
            role="tab"
            aria-selected={active}
            aria-label={tab.label}
            onClick={() => {
              if (i !== activeTab) {
                navigator.vibrate?.(10);
                onTabChange(i);
              }
            }}
            style={{
              flex: 1,
              height: "100%",
              minHeight: 44,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              position: "relative",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Icon
              size={20}
              strokeWidth={1.5}
              color={active ? "var(--text-display)" : "var(--text-disabled)"}
            />
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? "var(--text-display)" : "var(--text-disabled)",
              }}
            >
              {tab.label}
            </span>
            {active && (
              <motion.div
                layoutId="tab-indicator"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "25%",
                  right: "25%",
                  height: 2,
                  background: "var(--accent)",
                  borderRadius: 1,
                }}
                transition={{
                  type: "tween",
                  duration: 0.25,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
