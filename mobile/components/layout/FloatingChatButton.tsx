// [claude-code 2026-04-16] S20: Chat FAB — 3-state status indicator (idle/loading/success)
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Check } from "../shared/iso-icons";
import { useHaptic } from "../../hooks/useHaptic";
import { useActivityStatus } from "../../contexts/ActivityStatusContext";
import { RadarSpinner } from "../shared/RadarSpinner";

const SUCCESS_GREEN = "oklch(0.62 0.10 145)";
const NOTHING_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

interface FloatingChatButtonProps {
  onTap: () => void;
}

export function FloatingChatButton({ onTap }: FloatingChatButtonProps) {
  const vibrate = useHaptic();
  const { activityState } = useActivityStatus();

  return (
    <button
      onClick={() => {
        vibrate(10);
        onTap();
      }}
      aria-label="Open chat"
      style={{
        position: "fixed",
        bottom: "calc(24px + env(safe-area-inset-bottom))",
        right: 20,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "var(--accent)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 30,
        WebkitTapHighlightColor: "transparent",
        boxShadow:
          activityState === "success"
            ? `0 0 10px 2px ${SUCCESS_GREEN}`
            : "none",
        transition: "box-shadow 0.4s ease-out",
      }}
    >
      <AnimatePresence mode="wait">
        {activityState === "loading" && (
          <motion.div
            key="radar"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2, ease: NOTHING_EASE }}
            style={{ display: "flex" }}
          >
            <RadarSpinner size={22} color="var(--black, #000)" />
          </motion.div>
        )}
        {activityState === "success" && (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2, ease: NOTHING_EASE }}
            style={{ display: "flex" }}
          >
            <Check size={24} color={SUCCESS_GREEN} strokeWidth={2.5} />
          </motion.div>
        )}
        {activityState === "idle" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25, ease: NOTHING_EASE }}
            style={{ display: "flex" }}
          >
            <MessageSquare size={24} color="var(--black, #000)" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
