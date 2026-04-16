// [claude-code 2026-04-16] T7: Toolbar — offline indicator, clean header, bulletin moved to floating button
import { Menu } from "lucide-react";
import { VixBadge } from "../shared/VixBadge";
import { useSettings } from "../../contexts/SettingsContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

interface MobileToolbarProps {
  onHamburgerTap: () => void;
  menuOpen: boolean;
}

export function MobileToolbar({ onHamburgerTap }: MobileToolbarProps) {
  const { settings } = useSettings();
  const traderName = settings.traderName || "";
  const isOnline = useOnlineStatus();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "var(--black)",
        zIndex: 40,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Main bar */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Wordmark + Trader Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: 18,
              color: "var(--accent)",
              letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
            }}
          >
            Fintheon
          </span>
          {traderName && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-visible)",
                paddingLeft: 8,
              }}
            >
              {traderName}
            </span>
          )}
        </div>

        {/* VIX center / offline indicator */}
        {isOnline ? (
          <VixBadge variant="compact" />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--error)",
              fontWeight: 600,
            }}
          >
            [OFFLINE]
          </span>
        )}

        {/* Hamburger */}
        <button
          onClick={onHamburgerTap}
          aria-label="Open menu"
          style={{
            background: "transparent",
            border: "none",
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Menu size={20} strokeWidth={1.5} color="var(--text-secondary)" />
        </button>
      </div>
    </div>
  );
}
