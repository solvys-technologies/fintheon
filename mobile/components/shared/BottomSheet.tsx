// [claude-code 2026-04-15] T4: Bottom sheet — slide-up modal with drag-to-close
import { type ReactNode, useRef, useCallback } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (Math.abs(info.velocity.y) > 300 || info.offset.y > 100) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              zIndex: 998,
            }}
          />

          {/* Sheet */}
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
              maxHeight: "85vh",
              background: "var(--surface)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
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
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 2,
                  borderRadius: 1,
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
                }}
              >
                {title}
              </div>
            )}

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 16px 16px",
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
