// [claude-code 2026-04-19] TP beta polish: the save control was previously a bare
//   checkmark that read as a status indicator. TP's intent is that it's a BUTTON —
//   user must tap to commit. Gives it a clearly pressable frame (accent-tinted pill),
//   shows a subtle green flash on success, then fades out when isDirty clears.
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const SUCCESS_GREEN = "oklch(0.62 0.10 145)";

interface SaveButtonProps {
  visible: boolean;
  saving: boolean;
  onSave: () => Promise<void>;
}

export function SaveButton({ visible, saving, onSave }: SaveButtonProps) {
  const [flashGreen, setFlashGreen] = useState(false);

  const handleTap = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (saving) return;
      await onSave();
      setFlashGreen(true);
      window.setTimeout(() => setFlashGreen(false), 1200);
    },
    [onSave, saving],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2, ease: NOTHING_EASE }}
          onClick={handleTap}
          disabled={saving}
          aria-label="Save changes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: flashGreen
              ? `color-mix(in srgb, ${SUCCESS_GREEN} 18%, transparent)`
              : "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: `1px solid ${
              flashGreen
                ? `color-mix(in srgb, ${SUCCESS_GREEN} 45%, transparent)`
                : "color-mix(in srgb, var(--accent) 45%, transparent)"
            }`,
            borderRadius: 999,
            color: flashGreen ? SUCCESS_GREEN : "var(--accent)",
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: saving ? "wait" : "pointer",
            minHeight: 32,
            opacity: saving ? 0.6 : 1,
            WebkitTapHighlightColor: "transparent",
            transition:
              "background 250ms ease, border-color 250ms ease, color 250ms ease, opacity 200ms ease",
          }}
        >
          <Check size={12} strokeWidth={2.5} />
          <span>{saving ? "Saving" : flashGreen ? "Saved" : "Save"}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
