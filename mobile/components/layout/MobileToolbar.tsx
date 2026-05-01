// [claude-code 2026-04-19] TP beta polish: swap SaveCheckmark (read as status) for
//   the new SaveButton (reads as a tap target). Same position, same isDirty/saveAll wiring.
// [claude-code 2026-04-18] A4: mounted NotificationBell next to hamburger
// [claude-code 2026-04-16] S20: Toolbar — global save checkmark under hamburger
// [claude-code 2026-04-17] Toolbar VIX fades in only when Dash hero VIX is off-screen
// [claude-code 2026-05-01] S56 Track D: hamburger ↔ back-arrow cross-fade on menuOpen
import { Menu, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { VixBadge } from "../shared/VixBadge";
import { SaveButton } from "../settings/SaveButton";
import { NotificationBell } from "../notifications/NotificationBell";
import { useSettings } from "../../contexts/SettingsContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useHeroVixVisibleStore } from "../../hooks/useHeroVixVisible";

interface MobileToolbarProps {
  onHamburgerTap: () => void;
  menuOpen: boolean;
}

export function MobileToolbar({ onHamburgerTap, menuOpen }: MobileToolbarProps) {
  const { settings, isDirty, isSaving, saveAll } = useSettings();
  const traderName = settings.traderName || "";
  const isOnline = useOnlineStatus();
  const heroVixVisible = useHeroVixVisibleStore((s) => s.visible);
  const showToolbarVix = isOnline && !heroVixVisible;

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

        {/* VIX center — fades in once the Dash hero VIX is scrolled off-screen */}
        <AnimatePresence mode="wait">
          {!isOnline ? (
            <motion.span
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
            </motion.span>
          ) : showToolbarVix ? (
            <motion.div
              key="vix"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <VixBadge variant="compact" />
            </motion.div>
          ) : (
            <span key="spacer" aria-hidden="true" />
          )}
        </AnimatePresence>

        {/* Right cluster: notification bell + hamburger/back-arrow */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <NotificationBell />
          <button
            onClick={onHamburgerTap}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
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
              position: "relative",
            }}
          >
            <AnimatePresence mode="wait">
              {menuOpen ? (
                <motion.div
                  key="back"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                  style={{ position: "absolute" }}
                >
                  <ArrowLeft size={20} strokeWidth={1.5} color="var(--accent, #c79f4a)" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.15 }}
                  style={{ position: "absolute" }}
                >
                  <Menu size={20} strokeWidth={1.5} color="var(--text-secondary)" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Global save — sticky pill below hamburger, only when there are staged changes */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 52px)",
          right: 20,
          zIndex: 41,
        }}
      >
        <SaveButton visible={isDirty} saving={isSaving} onSave={saveAll} />
      </div>
    </div>
  );
}
