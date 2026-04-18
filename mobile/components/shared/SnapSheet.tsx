// [claude-code 2026-04-19] Generalized from NotificationSheet. Top-anchored sheet that opens
//   to a target element's bottom edge (e.g. the dash fuse-bar row) — so only tickers + fuses
//   stay visible above. Used by NotificationDrawer + MobileBulletin.
//   Glassmorphic surface by default (not Kanban — TP's design rule).
import {
  type ReactNode,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface SnapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** CSS selector for the element whose bottom edge the sheet should snap under. */
  anchorSelector?: string;
  /** Fallback top inset in px (from the top of the viewport) when the anchor isn't found. */
  fallbackTopPx?: number;
}

/**
 * Opens upward from the bottom, snapping its top edge just under `anchorSelector`
 * (defaults to `[data-snap-anchor="fuses"]`). Page auto-scrolls to top so the
 * anchor is visible before the sheet settles. Drag-down-to-close.
 */
export function SnapSheet({
  isOpen,
  onClose,
  title,
  children,
  anchorSelector = "[data-snap-anchor='fuses']",
  fallbackTopPx = 340,
}: SnapSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [topPx, setTopPx] = useState<number>(fallbackTopPx);

  // Snap page to top so the anchor row renders into view, then measure it.
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document
        .querySelectorAll<HTMLElement>("[data-scroll-container='true']")
        .forEach((el) => el.scrollTo({ top: 0, behavior: "smooth" }));
      requestAnimationFrame(() => {
        const anchor = document.querySelector<HTMLElement>(anchorSelector);
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          // 6px breathing room below the fuse row
          setTopPx(Math.max(0, Math.round(rect.bottom + 6)));
        } else {
          setTopPx(fallbackTopPx);
        }
      });
    });
  }, [isOpen, anchorSelector, fallbackTopPx]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.velocity.y > 300 || info.offset.y > 100) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — clears the ticker/fuses area so taps above dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              top: `calc(env(safe-area-inset-top, 0px) + 48px)`,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
              zIndex: 998,
            }}
          />

          {/* Sheet — glassmorphic, top-anchored under the fuse row */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{
              position: "fixed",
              top: topPx,
              left: 0,
              right: 0,
              bottom: 0,
              background: "var(--surface)",
              backdropFilter: "blur(24px) saturate(1.4)",
              WebkitBackdropFilter: "blur(24px) saturate(1.4)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTop: "1px solid var(--border-visible)",
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -12px 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Handle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 8,
                paddingBottom: 8,
                cursor: "grab",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 3,
                  borderRadius: 2,
                  background: "var(--border-visible)",
                }}
              />
            </div>

            {/* Title */}
            {title && (
              <div
                style={{
                  textAlign: "center",
                  padding: "0 16px 8px",
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

            {/* Content */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "0 16px calc(16px + env(safe-area-inset-bottom, 0px))",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
