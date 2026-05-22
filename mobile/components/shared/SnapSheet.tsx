// [claude-code 2026-04-19] S26-P2 T1: gesture-math rewrite per TP — bulletin kept
//   collapsing on the lightest scroll-up because the whole sheet was draggable and
//   thresholds were lenient (velocity OR offset). Now: only the pill handle drags.
//   Content scrolls in place (overflowY: auto stays). Dismiss requires the AND of
//   offset > 260 AND velocity > 500, OR a deliberate tap on the pill handle. Pill
//   tint shifts to accent on press so tap/drag affordance is obvious. dragElastic
//   dropped to 0.08 so pushing past the threshold barely rubber-bands.
// [claude-code 2026-04-19] TP standard: every popup in the app uses this surface. Pill bar
//   sized like the Daily Brief overlay (40x5, 12/8 padding), title pad 16/12. Glassmorphic
//   (TP: glass before kanban, always).
// [claude-code 2026-04-19] Generalized from NotificationSheet. Top-anchored sheet that opens
//   to a target element's bottom edge (e.g. the dash fuse-bar row) — so only tickers + fuses
//   stay visible above. Used by NotificationDrawer + MobileBulletin + BriefingCard.
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

/** AND-threshold for dismiss — TP explicitly asked for a much wider swipe + faster
 *  flick before the sheet collapses. OR thresholds (the old rule) tripped on the
 *  lightest scroll-up, which made reading bulletin copy basically impossible. */
const DISMISS_OFFSET = 260;
const DISMISS_VELOCITY = 500;

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

  // Snap page to top instantly (not smooth — smooth scroll is async and rect.bottom
  // was being measured mid-scroll, giving a wrong Y). Then measure the anchor.
  useEffect(() => {
    if (!isOpen) return;
    window.scrollTo({ top: 0, behavior: "auto" });
    document
      .querySelectorAll<HTMLElement>("[data-scroll-container='true']")
      .forEach((el) => el.scrollTo({ top: 0, behavior: "auto" }));
    requestAnimationFrame(() => {
      const anchor = document.querySelector<HTMLElement>(anchorSelector);
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        setTopPx(Math.max(0, Math.round(rect.bottom + 4)));
      } else {
        setTopPx(fallbackTopPx);
      }
    });
  }, [isOpen, anchorSelector, fallbackTopPx]);

  const handleHandleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (
        info.offset.y > DISMISS_OFFSET &&
        info.velocity.y > DISMISS_VELOCITY
      ) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — tap above the sheet dismisses */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fintheon-modal-backdrop"
            style={{
              position: "fixed",
              top: `calc(env(safe-area-inset-top, 0px) + 48px)`,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
          />

          {/* Sheet — static when open. Content scrolls; the sheet itself does NOT
              translate during vertical gestures unless they start on the pill handle. */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fintheon-sheet-surface"
            style={{
              position: "fixed",
              top: topPx,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Handle — the ONLY drag/tap dismiss target. Tap closes, swipe-down
                requires AND(offset>260, velocity>500) to dismiss. Hit target is
                padded for finger width; visible pill stays 40×5. */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.08}
              onDragEnd={handleHandleDragEnd}
              onClick={onClose}
              whileTap={{ scale: 0.96 }}
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px 32px 12px",
                cursor: "grab",
                flexShrink: 0,
                touchAction: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <motion.div
                initial={{
                  background:
                    "color-mix(in srgb, var(--fintheon-accent) 26%, transparent)",
                }}
                whileTap={{
                  background:
                    "color-mix(in srgb, var(--fintheon-accent) 44%, transparent)",
                }}
                className="fintheon-glass-handle"
                style={{ transition: "background 120ms ease" }}
              />
            </motion.div>

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

            {/* Content — scrolls in place. overscrollBehavior: contain prevents
                the iOS bounce from propagating as a drag on the ancestor. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "0 10px calc(16px + env(safe-area-inset-bottom, 0px))",
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
