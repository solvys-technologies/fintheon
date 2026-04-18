// [claude-code 2026-04-19] S25: lean approval detail view — no embed, no IV fuse, no Ask CAO.
//   Just the InlineApprovalCard in full mode with a live countdown and Approve/Deny wired to
//   POST /api/harper/tool-decision. Uses the same cognition-emitter resolution path as the
//   drawer's inline approvals, so existing SSE listeners continue to work.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  InlineApprovalCard,
  type ApprovalAction,
  type ApprovalStatus,
} from "../approvals/InlineApprovalCard";
import { DetailHeader } from "./DetailHeader";
import { useToolApprovalById } from "../../hooks/useToolApprovalById";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Props {
  approvalId: string;
  onClose: () => void;
}

export function ToolApprovalDetail({ approvalId, onClose }: Props) {
  const { getAccessToken } = useAuth();
  const { data, isLoading, error } = useToolApprovalById(approvalId);
  const [status, setStatus] = useState<ApprovalStatus>("pending");

  async function decide(decision: "approved" | "denied") {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/harper/tool-decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ approvalId, decision }),
      });
      if (res.ok) setStatus(decision);
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const actions: ApprovalAction[] = useMemo(
    () => [
      {
        id: "deny",
        label: "Deny",
        intent: "secondary",
        onClick: () => decide("denied"),
      },
      {
        id: "approve",
        label: "Approve",
        intent: "primary",
        onClick: () => decide("approved"),
      },
    ],
    // decide closes over approvalId which is stable per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approvalId],
  );

  return (
    <div style={{ paddingTop: 4 }}>
      <DetailHeader label="Tool Approval" severity="high" onClose={onClose} />

      {isLoading && <LoadingBlock />}
      {error && !isLoading && <ErrorBlock message={error} />}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 0.1, 0.2, 1] }}
        >
          <InlineApprovalCard
            variant="toolApproval"
            title={data.approval.toolName}
            subtitle="Harper needs permission"
            description={data.approval.description}
            payload={data.approval.toolInput}
            severity="high"
            expiresAt={data.expiresAt}
            serverNow={data.serverNow}
            status={status}
            actions={actions}
          />
        </motion.div>
      )}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        padding: "40px 0",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING APPROVAL...]
      </span>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "24px 16px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: 13,
        fontFamily: "var(--font-body)",
      }}
    >
      {message}
    </div>
  );
}
