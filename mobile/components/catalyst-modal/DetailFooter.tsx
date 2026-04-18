// [claude-code 2026-04-19] S25: detail-sheet footer — IV fuse on top, "Ask CAO" CTA below.
//   Button is borderless, transparent bg, accent letters per TP glass rule. On press the
//   button scales + animates an accent glow that trails the tap point; meanwhile the hook
//   seeds the conversation and navigates to Chat.
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { IVFuseBar, type FuseSeverity } from "../shared/IVFuseBar";
import { useAskCAO, type AskCAOInput } from "../../hooks/useAskCAO";
import { useHaptic } from "../../hooks/useHaptic";

interface Props {
  /** 0-10 score from RiskFlow feed items (existing per-item ivScore). */
  iv: number;
  severity: FuseSeverity;
  label?: string;
  dispatch: AskCAOInput;
  /** Fires after the dispatch succeeds — parents use this to close the modal + route to Chat. */
  onDispatched: (conversationId: string) => void;
}

export function DetailFooter({
  iv,
  severity,
  label,
  dispatch,
  onDispatched,
}: Props) {
  const { ask, isPending, error } = useAskCAO();
  const vibrate = useHaptic();

  const onAsk = async () => {
    vibrate(12);
    const id = await ask(dispatch);
    if (id) onDispatched(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 0.1, 0.2, 1] }}
      style={{
        marginTop: 20,
        padding: "14px 0 4px",
        borderTop:
          "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <IVFuseBar iv={iv} severity={severity} label={label ?? "IV"} />

      <motion.button
        type="button"
        onClick={onAsk}
        disabled={isPending}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 540, damping: 30 }}
        aria-busy={isPending}
        style={{
          width: "100%",
          minHeight: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          padding: "12px 16px",
          fontFamily: "var(--font-data)",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 700,
          cursor: isPending ? "progress" : "pointer",
          opacity: isPending ? 0.6 : 1,
          WebkitTapHighlightColor: "transparent",
          position: "relative",
        }}
      >
        <span>Ask CAO</span>
        <motion.span
          animate={isPending ? { x: [0, 3, 0] } : { x: 0 }}
          transition={{
            duration: 0.9,
            repeat: isPending ? Infinity : 0,
            ease: "easeInOut",
          }}
          style={{ display: "inline-flex" }}
        >
          <ArrowRight size={14} />
        </motion.span>
      </motion.button>

      {error && (
        <span
          role="alert"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--error, #d84f4f)",
            textAlign: "center",
          }}
        >
          {error}
        </span>
      )}
    </motion.div>
  );
}
