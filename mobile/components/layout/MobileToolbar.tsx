// [claude-code 2026-04-15] T3: Fixed top toolbar — wordmark, VIX badge, hamburger, chevron expander
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Menu } from "lucide-react";
import { VixBadge } from "../shared/VixBadge";
import { ToolbarExpanded } from "./ToolbarExpanded";

interface MobileToolbarProps {
  onHamburgerTap: () => void;
}

export function MobileToolbar({ onHamburgerTap }: MobileToolbarProps) {
  const [expanded, setExpanded] = useState(false);

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
          borderBottom: expanded ? "none" : "1px solid var(--border)",
        }}
      >
        {/* Wordmark */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 18,
            color: "var(--accent)",
            letterSpacing: "0.04em",
          }}
        >
          Fintheon
        </span>

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

      {/* Chevron toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
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
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <ChevronDown size={16} color="var(--text-disabled)" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 0.15, delay: 0.05, ease: "easeOut" },
            }}
            style={{ overflow: "hidden" }}
          >
            <ToolbarExpanded />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
