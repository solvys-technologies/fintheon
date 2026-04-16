// [claude-code 2026-04-16] Toolbar — chevron opens BottomSheet bulletin overlay instead of inline expand
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Menu } from "lucide-react";
import { VixBadge } from "../shared/VixBadge";
import { BottomSheet } from "../shared/BottomSheet";
import { ToolbarExpanded } from "./ToolbarExpanded";
import { HamburgerMenu } from "./HamburgerMenu";
import { useSettings } from "../../contexts/SettingsContext";

interface MobileToolbarProps {
  onHamburgerTap: () => void;
  menuOpen: boolean;
}

export function MobileToolbar({
  onHamburgerTap,
  menuOpen,
}: MobileToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { settings } = useSettings();
  const traderName = settings.traderName || "";

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
          borderBottom: "none",
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

        {/* VIX center */}
        <VixBadge />

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

      {/* Chevron toggle — opens bulletin BottomSheet */}
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Open bulletin"
        style={{
          width: "100%",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--border)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          padding: 0,
        }}
      >
        <motion.div
          animate={{ rotate: sheetOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ChevronDown size={16} color="var(--text-disabled)" />
        </motion.div>
      </button>

      {/* Bulletin BottomSheet */}
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="BULLETIN"
      >
        <ToolbarExpanded />
      </BottomSheet>
    </div>
  );
}
