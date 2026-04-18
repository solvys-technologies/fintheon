// [claude-code 2026-04-19] Anchored under the dash fuse row per TP (briefing covers the REST of
//   the page, not the whole screen — tickers + fuses stay visible). Uses the same data-snap-anchor
//   discovery as SnapSheet.
// [claude-code 2026-04-16] Full-screen briefing popover with iOS pill bar swipe-to-dismiss
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface BriefingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const FALLBACK_TOP_PX = 340;
const ANCHOR_SELECTOR = "[data-snap-anchor='fuses']";

export function BriefingOverlay({
  isOpen,
  onClose,
  title,
  children,
}: BriefingOverlayProps) {
  const [topPx, setTopPx] = useState<number>(FALLBACK_TOP_PX);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      requestAnimationFrame(() => {
        const anchor = document.querySelector<HTMLElement>(ANCHOR_SELECTOR);
        if (anchor) {
          setTopPx(
            Math.max(0, Math.round(anchor.getBoundingClientRect().bottom + 6)),
          );
        } else {
          setTopPx(FALLBACK_TOP_PX);
        }
      });
    });
  }, [isOpen]);

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
            top: topPx,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            background: "var(--surface)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTop: "1px solid var(--border-visible)",
            boxShadow: "0 -12px 40px rgba(0,0,0,0.6)",
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
              paddingTop: 12,
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
              minHeight: 0,
              overflowY: "auto",
              padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
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
