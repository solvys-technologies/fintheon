// [claude-code 2026-04-19] S25: reusable glass approval card — used by NotificationDrawer
//   (compact), DetailSheet ToolApprovalDetail (full), and a chat-stream stub for generative
//   task previews. One component, three surfaces. Generic `actions` array so the same shape
//   can render Approve/Deny today and Run/Edit/Skip/Commit tomorrow without rework.
//
//   Micro-interactions:
//     • entry: fade+lift-in with spring
//     • action button press: scale 0.95 + borderless accent letters per TP
//     • status transition: color sweep from accent → success/error with spring
//     • payload preview: expand/collapse with layout animation + caret rotate
//     • countdown: live seconds tick that softens as time runs out
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { MICRO_SPRING } from "../../lib/sheet-motion";

export type ApprovalVariant = "toolApproval" | "generativeTask" | "custom";

export type ApprovalActionIntent = "primary" | "secondary" | "destructive";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "running"
  | "complete"
  | "error";

export interface ApprovalAction {
  id: string;
  label: string;
  intent: ApprovalActionIntent;
  onClick: () => void | Promise<void>;
  /** Hide this action when the card resolves (default true). */
  hideOnResolve?: boolean;
}

export interface InlineApprovalCardProps {
  variant: ApprovalVariant;
  title: string;
  subtitle?: string;
  description?: string;
  /** Pretty-printed in a collapsible <details> when in full mode. */
  payload?: unknown;
  severity?: "low" | "medium" | "high" | "critical";
  /** Absolute epoch ms when the approval expires — null for relay/blocking approvals. */
  expiresAt?: number | null;
  serverNow?: number;
  status?: ApprovalStatus;
  actions?: ApprovalAction[];
  /** Compact mode: drawer/chat — condensed padding, no payload toggle, smaller type. */
  compact?: boolean;
}

const statusLabel: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: "PENDING", color: "var(--text-secondary)" },
  approved: { label: "APPROVED", color: "var(--success, #4ade80)" },
  denied: { label: "DENIED", color: "var(--error, #d84f4f)" },
  running: { label: "RUNNING", color: "var(--accent)" },
  complete: { label: "COMPLETE", color: "var(--success, #4ade80)" },
  error: { label: "ERROR", color: "var(--error, #d84f4f)" },
};

const severityDot: Record<
  NonNullable<InlineApprovalCardProps["severity"]>,
  string
> = {
  low: "var(--text-disabled)",
  medium: "var(--accent)",
  high: "var(--warning, #f0b055)",
  critical: "var(--error, #d84f4f)",
};

export function InlineApprovalCard({
  variant,
  title,
  subtitle,
  description,
  payload,
  severity,
  expiresAt,
  serverNow,
  status = "pending",
  actions = [],
  compact = false,
}: InlineApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const resolved = status !== "pending" && status !== "running";

  const visibleActions = actions.filter(
    (a) => !resolved || !(a.hideOnResolve ?? true),
  );

  const payloadJson = useMemo(() => {
    if (payload === undefined || payload === null) return null;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }, [payload]);

  const countdown = useCountdown(expiresAt, serverNow);
  const showCountdown =
    !compact && status === "pending" && typeof expiresAt === "number";

  async function onClickAction(a: ApprovalAction) {
    try {
      setPendingActionId(a.id);
      await a.onClick();
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }}
      transition={MICRO_SPRING}
      layout
      style={{
        background: "color-mix(in srgb, var(--bg, #050402) 55%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
        borderRadius: 14,
        padding: compact ? "10px 12px" : "14px 16px 12px",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        opacity: resolved ? 0.7 : 1,
        transition: "opacity 220ms ease",
      }}
    >
      {/* Header row: variant chip + severity dot + status pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: compact ? 4 : 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {variantLabel(variant)}
        </span>

        <div
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          aria-live="polite"
        >
          {severity && (
            <span
              aria-label={`Severity ${severity}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: severityDot[severity],
                boxShadow: `0 0 8px ${severityDot[severity]}`,
              }}
            />
          )}
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={MICRO_SPRING}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: statusLabel[status].color,
            }}
          >
            {statusLabel[status].label}
          </motion.span>
        </div>
      </div>

      {/* Title + subtitle */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: compact ? 13 : 15,
          lineHeight: 1.35,
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      )}

      {description && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: compact ? 12 : 13,
            lineHeight: 1.45,
            color: "var(--text-secondary)",
            marginTop: compact ? 4 : 8,
          }}
        >
          {description}
        </div>
      )}

      {/* Countdown (full mode only, pending only) */}
      {showCountdown && (
        <div
          style={{
            marginTop: 8,
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color:
              countdown <= 5
                ? "var(--error, #d84f4f)"
                : "var(--text-secondary)",
          }}
        >
          {countdown > 0 ? `Auto-approve in ${countdown}s` : "Window expired"}
        </div>
      )}

      {/* Payload preview (full mode only) */}
      {!compact && payloadJson && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              padding: 0,
              color: "var(--text-secondary)",
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            <motion.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ display: "inline-flex" }}
            >
              <ChevronRight size={12} />
            </motion.span>
            {expanded ? "Hide input" : "Show input"}
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.pre
                key="payload"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 0.1, 0.2, 1] }}
                style={{
                  margin: "8px 0 0",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background:
                    "color-mix(in srgb, var(--accent) 4%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--accent) 10%, transparent)",
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  overflowX: "auto",
                  whiteSpace: "pre",
                  maxHeight: 220,
                }}
              >
                {payloadJson}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actions — borderless accent-letter per TP (no bg, no border) */}
      {visibleActions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: compact ? 8 : 14,
            alignItems: "center",
            justifyContent: compact ? "flex-start" : "flex-end",
          }}
        >
          {visibleActions.map((a, i) => (
            <motion.button
              key={a.id}
              type="button"
              onClick={() => void onClickAction(a)}
              disabled={pendingActionId !== null || resolved}
              whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.04 * i,
                type: "spring",
                stiffness: 520,
                damping: 30,
              }}
              aria-busy={pendingActionId === a.id}
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 4px",
                fontFamily: "var(--font-data)",
                fontSize: compact ? 11 : 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: actionColor(a.intent),
                fontWeight: a.intent === "primary" ? 700 : 600,
                cursor:
                  pendingActionId !== null || resolved
                    ? "not-allowed"
                    : "pointer",
                opacity: pendingActionId === a.id ? 0.5 : 1,
                WebkitTapHighlightColor: "transparent",
                transition: "opacity 150ms ease",
              }}
            >
              {a.label}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── helpers ──

function variantLabel(v: ApprovalVariant): string {
  switch (v) {
    case "toolApproval":
      return "Tool Approval";
    case "generativeTask":
      return "Generative Task";
    default:
      return "Decision";
  }
}

function actionColor(intent: ApprovalActionIntent): string {
  switch (intent) {
    case "destructive":
      return "var(--error, #d84f4f)";
    case "secondary":
      return "var(--text-secondary)";
    default:
      return "var(--accent)";
  }
}

/** 1-second tick countdown in whole seconds. Returns 0 past expiry. */
function useCountdown(
  expiresAt: number | null | undefined,
  serverNow?: number,
): number {
  const [now, setNow] = useState<number>(() =>
    typeof serverNow === "number" ? serverNow : Date.now(),
  );
  useEffect(() => {
    if (typeof expiresAt !== "number") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (typeof expiresAt !== "number") return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}
