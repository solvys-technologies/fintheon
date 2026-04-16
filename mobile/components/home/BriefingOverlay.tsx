// [claude-code 2026-04-16] Full-screen briefing popover with iOS pill bar swipe-to-dismiss
import { type ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface BriefingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BriefingOverlay({
  isOpen,
  onClose,
  title,
  children,
}: BriefingOverlayProps) {
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.velocity.y > 300 || info.offset.y > 120) onClose();
    },
    [onClose],
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            touchAction: "none",
          }}
        >
          {/* iOS pill bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: `calc(env(safe-area-inset-top, 0px) + 12px)`,
              paddingBottom: 8,
              cursor: "grab",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 40,
                height: 5,
                borderRadius: 3,
                background: "var(--border-visible)",
              }}
            />
          </div>

          {/* Title */}
          {title && (
            <div
              style={{
                textAlign: "center",
                padding: "0 16px 12px",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                flexShrink: 0,
              }}
            >
              {title}
            </div>
          )}

          {/* Scrollable content */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
