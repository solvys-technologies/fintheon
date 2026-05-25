// [claude-code 2026-04-19] S25: full-viewport glass sheet — separate primitive from SnapSheet
//   (which is fuse-row-anchored). Used by the catalyst/riskflow/approval DetailSheet flow.
//   Micro-interactions:
//     • slide-up entry with shared easing from sheet-motion.ts
//     • drag-down-to-close with elastic bounce + velocity threshold
//     • backdrop fades slightly slower than sheet for weighted feel
//     • handle pill scales up on grab
//     • ESC + scrim tap close
//     • body scroll locked while open (safe-area aware)
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  BACKDROP_TRANSITION,
  SHEET_ENTRY,
  shouldDismissFromDrag,
} from "../../lib/sheet-motion";

interface DetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export function DetailSheet({
  isOpen,
  onClose,
  children,
  ariaLabel = "Detail",
}: DetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open — restore on close (no snap, preserves scroll position)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ESC closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (shouldDismissFromDrag(info)) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — heavier than SnapSheet because we're covering the whole viewport */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_TRANSITION}
            onClick={onClose}
            aria-hidden
            className="fintheon-modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1600,
            }}
          />

          {/* Sheet — full viewport, glassmorphic, drag-to-close */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SHEET_ENTRY}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            className="fintheon-sheet-surface"
            style={{
              position: "fixed",
              top: `calc(env(safe-area-inset-top, 0px) + 24px)`,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              zIndex: 1601,
              // Subtle inner highlight along the top edge so the glass catches light
              overflow: "hidden",
            }}
          >
            {/* Grab pill — scales up when touched so the affordance is felt, not seen */}
            <motion.div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 12,
                paddingBottom: 8,
                cursor: "grab",
                flexShrink: 0,
              }}
              whileTap={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              <div
                className="fintheon-glass-handle"
              />
            </motion.div>

            {/* Content region — scrolls, safe-area bottom inset */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))",
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
