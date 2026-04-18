// [claude-code 2026-04-16] Save indicator — single/double checkmark with fade-in + green glow on save
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";

interface SaveCheckmarkProps {
  visible: boolean;
  variant: "single" | "double";
  onSave?: () => Promise<void>;
}

// ~35% desaturated lime green in OKLCH space
const SUCCESS_GREEN = "oklch(0.62 0.10 145)";
const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export function SaveCheckmark({
  visible,
  variant,
  onSave,
}: SaveCheckmarkProps) {
  const [saving, setSaving] = useState(false);
  const [showGreen, setShowGreen] = useState(false);

  const handleTap = useCallback(async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave();
      setShowGreen(true);
      setTimeout(() => setShowGreen(false), 1500);
    } finally {
      setSaving(false);
    }
  }, [onSave, saving]);

  const Icon = variant === "double" ? CheckCheck : Check;
  const iconColor = showGreen ? SUCCESS_GREEN : "var(--accent)";

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: NOTHING_EASE }}
          onClick={handleTap}
          disabled={saving}
          aria-label={
            variant === "double" ? "Save all settings" : "Save section"
          }
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            cursor: onSave ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            filter: showGreen
              ? `drop-shadow(0 0 5px ${SUCCESS_GREEN})`
              : "none",
            transition: "filter 0.4s ease-out",
          }}
        >
          <Icon
            size={variant === "double" ? 20 : 16}
            color={iconColor}
            strokeWidth={2}
            style={{
              transition: "color 0.3s ease-out",
            }}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
