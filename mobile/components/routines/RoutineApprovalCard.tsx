// [claude-code 2026-04-19] Routines Console — mobile Superadmin approval card.
// Slide-up sheet with one large card per pending routine — Approve / Deny.

import { useEffect, useState } from "react";
import { Check, ChevronDown, RefreshCw, X } from "lucide-react";
import { BottomSheet } from "../shared/BottomSheet";
import { useHaptic } from "../../hooks/useHaptic";
import {
  useRoutineApprovals,
  type RoutineApproval,
} from "../../hooks/useRoutineApprovals";

interface RoutineApprovalCardProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function ApprovalCard({
  approval,
  onApprove,
  onDeny,
}: {
  approval: RoutineApproval;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const vibrate = useHaptic();
  const [expanded, setExpanded] = useState(false);

  const routineName =
    (approval.payload?.routineName as string | undefined) ?? approval.triggerId;
  const severity = (approval.payload?.severity as string | undefined) ?? "info";
  const detail = approval.payload?.detail as string | undefined;

  const accentColor =
    severity === "critical"
      ? "var(--accent-danger, #ef4444)"
      : severity === "warning"
        ? "var(--accent-warning, #f59e0b)"
        : "var(--accent, #c79f4a)";

  return (
    <div
      style={{
        background: "var(--surface-raised, #1a1a1a)",
        border: `1px solid ${accentColor}55`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-secondary, #888)",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginBottom: 4,
          }}
        >
          {routineName}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary, #f0ead6)",
            lineHeight: 1.3,
          }}
        >
          {approval.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary, #888)",
            marginTop: 6,
          }}
        >
          posted {formatTime(approval.createdAt)}
        </div>
      </div>

      {detail && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary, #f0ead6)",
            background: "var(--surface, #0e0e0e)",
            border: "1px solid var(--border-subtle, #2a2a2a)",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
            whiteSpace: "pre-wrap",
            lineHeight: 1.45,
          }}
        >
          {detail}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          fontSize: 11,
          color: "var(--text-secondary, #888)",
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
          marginBottom: expanded ? 8 : 14,
        }}
      >
        <ChevronDown
          size={12}
          style={{
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
        raw payload
      </button>

      {expanded && (
        <pre
          style={{
            fontSize: 10,
            color: "var(--text-secondary, #888)",
            background: "var(--surface, #0e0e0e)",
            border: "1px solid var(--border-subtle, #2a2a2a)",
            borderRadius: 8,
            padding: 8,
            marginBottom: 14,
            maxHeight: 160,
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(approval.payload, null, 2)}
        </pre>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            vibrate(15);
            onDeny();
          }}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "transparent",
            border: "1px solid var(--accent-danger, #ef4444)55",
            color: "var(--accent-danger, #ef4444)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <X size={16} />
          Deny
        </button>
        <button
          onClick={() => {
            vibrate(15);
            onApprove();
          }}
          style={{
            flex: 2,
            padding: "12px 16px",
            background: "var(--accent, #c79f4a)",
            border: "1px solid var(--accent, #c79f4a)",
            color: "var(--black, #050402)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <Check size={16} />
          Approve
        </button>
      </div>
    </div>
  );
}

export function RoutineApprovalCard({
  isOpen,
  onClose,
}: RoutineApprovalCardProps) {
  const { approvals, refresh, approve, deny, loading } = useRoutineApprovals();

  // Re-fetch every time the sheet opens so the operator sees fresh state.
  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Routine Approvals">
      <div style={{ padding: 14, paddingTop: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary, #888)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            {approvals.length} pending
          </div>
          <button
            onClick={() => refresh()}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary, #888)",
              padding: 4,
              cursor: "pointer",
            }}
            aria-label="Refresh"
          >
            <RefreshCw
              size={14}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
          </button>
        </div>

        {approvals.length === 0 ? (
          <div
            style={{
              padding: "32px 12px",
              textAlign: "center",
              color: "var(--text-secondary, #888)",
              fontSize: 13,
              border: "1px dashed var(--border-subtle, #2a2a2a)",
              borderRadius: 12,
            }}
          >
            No routines awaiting approval.
          </div>
        ) : (
          approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={() => approve(approval.id)}
              onDeny={() => deny(approval.id)}
            />
          ))
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </BottomSheet>
  );
}
