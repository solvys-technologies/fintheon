// [claude-code 2026-04-19] S24 unify: top-anchored 60vh notification sheet. Snaps page to top on open so the
// dash tickers stay visible above the sheet. Slides up from bottom to 60% viewport. Drag-down dismiss.
import { type ReactNode, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** How tall the sheet is, measured from the bottom of the viewport. */
const SHEET_HEIGHT_VH = 60;

export function NotificationSheet({
  isOpen,
  onClose,
  title,
  children,
}: NotificationSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Snap page to top so the dash ticker row sits above the sheet when it opens.
  useEffect(() => {
    if (!isOpen) return;
    // Let the drawer mount first, then scroll. Two rafs for safety on iOS Safari.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Scroll any inner scroll containers to top too
        document
          .querySelectorAll<HTMLElement>("[data-scroll-container='true']")
          .forEach((el) => el.scrollTo({ top: 0, behavior: "smooth" }));
      });
    });
  }, [isOpen]);

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
          {/* Backdrop — sits ABOVE the ticker row so taps below the sheet close it */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              // Top inset clears toolbar + leaves the hero ticker row visible
              top: `calc(env(safe-area-inset-top, 0px) + 48px)`,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 998,
            }}
          />

          {/* Sheet — anchored at bottom, climbs up to SHEET_HEIGHT_VH */}
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
              bottom: 0,
              left: 0,
              right: 0,
              height: `${SHEET_HEIGHT_VH}vh`,
              background: "var(--surface)",
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
