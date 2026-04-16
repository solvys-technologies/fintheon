// [claude-code 2026-04-16] T2: Inline approve/deny card for tool approval-gated calls
import { Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ToolApprovalCardProps {
  approvalId: string;
  toolName: string;
  description: string;
  toolInput?: Record<string, unknown>;
  status: "pending" | "approved" | "denied" | "auto";
  onDecision: (approvalId: string, decision: "approved" | "denied") => void;
}

const statusLabel: Record<string, { text: string; color: string }> = {
  approved: { text: "APPROVED", color: "#4ade80" },
  denied: { text: "DENIED", color: "#f87171" },
  auto: { text: "AUTO", color: "var(--text-disabled)" },
};

export function ToolApprovalCard({
  approvalId,
  toolName,
  description,
  toolInput,
  status,
  onDecision,
}: ToolApprovalCardProps) {
  const resolved = status !== "pending";
  const badge = resolved ? statusLabel[status] : null;

  const inputPreview = toolInput
    ? JSON.stringify(toolInput, null, 2).split("\n").slice(0, 3).join("\n")
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          margin: "4px 16px",
          border: "1px solid var(--border-visible)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid var(--border-visible)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-secondary)",
            }}
          >
            {toolName}
          </span>
          {badge && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: badge.color,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {status === "approved" && <Check size={10} />}
              {status === "denied" && <X size={10} />}
              {badge.text}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "8px 12px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontFamily: "var(--font-body)",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
          {inputPreview && (
            <pre
              style={{
                margin: "6px 0 0",
                padding: "6px 8px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.03)",
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "pre",
                maxHeight: 48,
              }}
            >
              {inputPreview}
            </pre>
          )}
        </div>

        {/* Footer — approve/deny buttons (pending only) */}
        {!resolved && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 12px",
              borderTop: "1px solid var(--border-visible)",
            }}
          >
            <button
              onClick={() => onDecision(approvalId, "approved")}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "none",
                background: "var(--accent)",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--black, #000)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              APPROVE
            </button>
            <button
              onClick={() => onDecision(approvalId, "denied")}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "1px solid var(--error)",
                background: "transparent",
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--error)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              DENY
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
