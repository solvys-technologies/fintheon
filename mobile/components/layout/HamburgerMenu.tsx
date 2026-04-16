// [claude-code 2026-04-15] S18: Header menu — section nav + Harper refresh, session, sign out
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";

interface HamburgerMenuProps {
  open: boolean;
  onClose: () => void;
  activeTab: number;
  onNavigate: (index: number) => void;
}

type HarperStatus = "idle" | "checking" | "connected" | "offline";

const NAV_ITEMS = [
  { label: "DASH", index: 0 },
  { label: "RISKFLOW", index: 1 },
  { label: "SETTINGS", index: 3 },
] as const;

export function HamburgerMenu({
  open,
  onClose,
  activeTab,
  onNavigate,
}: HamburgerMenuProps) {
  const { user, signOut, getAccessToken } = useAuth();
  const [harperStatus, setHarperStatus] = useState<HarperStatus>("idle");

  const handleRefreshHarper = useCallback(async () => {
    setHarperStatus("checking");
    try {
      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const token = await getAccessToken();
      const res = await fetch(`${apiBase}/api/harper/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setHarperStatus(res.ok ? "connected" : "offline");
    } catch {
      setHarperStatus("offline");
    }
    setTimeout(() => setHarperStatus("idle"), 3000);
  }, [getAccessToken]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    onClose();
  }, [signOut, onClose]);

  const handleNav = useCallback(
    (index: number) => {
      onNavigate(index);
      onClose();
    },
    [onNavigate, onClose],
  );

  const statusText: Record<HarperStatus, string> = {
    idle: "[REFRESH HARPER]",
    checking: "[CHECKING...]",
    connected: "[CONNECTED]",
    offline: "[OFFLINE]",
  };

  const statusColor: Record<HarperStatus, string> = {
    idle: "var(--text-primary)",
    checking: "var(--text-secondary)",
    connected: "var(--success)",
    offline: "var(--error)",
  };

  const rowStyle: React.CSSProperties = {
    height: 48,
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    borderBottom: "1px solid var(--border)",
    background: "transparent",
    border: "none",
    width: "100%",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              zIndex: 60,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "var(--surface)",
              borderRadius: "16px 16px 0 0",
              zIndex: 61,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {/* Handle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "12px 0 8px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: "var(--border-visible)",
                  borderRadius: 1,
                }}
              />
            </div>

            {/* Navigation */}
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.index;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.index)}
                  style={rowStyle}
                >
                  <span
                    style={{
                      ...labelStyle,
                      color: isActive ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    [{item.label}]
                  </span>
                </button>
              );
            })}
            <div className="fade-divider" style={{ margin: "4px 0" }} />

            {/* Refresh Harper */}
            <button
              onClick={handleRefreshHarper}
              disabled={harperStatus === "checking"}
              style={{
                ...rowStyle,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ ...labelStyle, color: statusColor[harperStatus] }}>
                {statusText[harperStatus]}
              </span>
            </button>

            {/* Session */}
            <div
              style={{ ...rowStyle, borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ ...labelStyle, color: "var(--text-secondary)" }}>
                [SESSION] {user?.email || "—"}
              </span>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              style={{ ...rowStyle, borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ ...labelStyle, color: "var(--error)" }}>
                [SIGN OUT]
              </span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
