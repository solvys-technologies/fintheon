import { useState } from "react";
import { Shield, ShieldCheck, ShieldX } from "lucide-react";
import { DiffPreview } from "./DiffPreview";
import type { MutationPayload } from "../../hooks/useUnifiedApproval";

interface UnifiedApprovalPipelineProps {
  mutation: MutationPayload;
  onApprove: () => void;
  onDeny: () => void;
}

type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "error";

const STATUS_STYLES: Record<ApprovalStatus, { badge: string; label: string }> =
  {
    pending: {
      badge: "text-amber-400 border-amber-400/40 bg-amber-400/10",
      label: "pending",
    },
    approved: {
      badge: "text-[#c79f4a] border-[#c79f4a]/40 bg-[#c79f4a]/10",
      label: "approved",
    },
    denied: {
      badge: "text-red-400 border-red-400/40 bg-red-400/10",
      label: "denied",
    },
    expired: {
      badge: "text-[#f0ead6]/30 border-[#f0ead6]/15 bg-[#f0ead6]/5",
      label: "expired",
    },
    error: {
      badge: "text-red-400 border-red-400/40 bg-red-400/10",
      label: "error",
    },
  };

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const { badge, label } = STATUS_STYLES[status];
  return (
    <span className={`text-xs font-mono border rounded px-1.5 py-0.5 ${badge}`}>
      {label}
    </span>
  );
}

export function UnifiedApprovalPipeline({
  mutation,
  onApprove,
  onDeny,
}: UnifiedApprovalPipelineProps) {
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [diffOpen, setDiffOpen] = useState(false);

  const isResolved = status !== "pending" && status !== "error";

  const handleApprove = () => {
    setStatus("approved");
    onApprove();
  };

  const handleDeny = () => {
    setStatus("denied");
    onDeny();
  };

  return (
    <div className="w-full max-w-2xl rounded border border-[#c79f4a]/20 bg-[#050402]/80 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#c79f4a]/20">
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-[#c79f4a]/50 shrink-0" />
          <span className="text-[#f0ead6] text-sm font-mono">
            {mutation.tool_name}
          </span>
          {mutation.agent_id && (
            <span className="text-[#f0ead6]/30 text-xs">
              via {mutation.agent_id}
            </span>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-[#c79f4a]/20">
        <p className="text-[#f0ead6]/80 text-sm leading-relaxed">
          {mutation.description}
        </p>
        {mutation.surface && (
          <p className="text-[#f0ead6]/30 text-xs mt-1">
            Surface: {mutation.surface}
          </p>
        )}
      </div>

      {/* Diff preview — collapsible */}
      <div className="border-b border-[#c79f4a]/20">
        <button
          onClick={() => setDiffOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-[#f0ead6]/30 text-xs hover:text-[#f0ead6]/50 transition-colors"
        >
          <span>Mutation payload</span>
          <span className="font-mono">{diffOpen ? "▲" : "▼"}</span>
        </button>
        {diffOpen && (
          <div className="px-4 pb-3">
            <DiffPreview
              before={null}
              after={mutation.tool_input}
              label={mutation.tool_name}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        {!isResolved ? (
          <>
            <button
              onClick={handleDeny}
              className="px-4 py-1.5 rounded border border-[#f0ead6]/15 text-[#f0ead6]/50 text-sm hover:border-red-400/40 hover:text-red-400/70 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              className="px-5 py-1.5 rounded bg-[#c79f4a] text-[#050402] text-sm font-medium hover:bg-[#c79f4a]/90 transition-colors"
            >
              Approve
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            {status === "approved" ? (
              <ShieldCheck size={13} className="text-[#c79f4a]" />
            ) : (
              <ShieldX size={13} className="text-red-400" />
            )}
            <span className="text-[#f0ead6]/50 text-sm">Decision recorded</span>
          </div>
        )}
      </div>
    </div>
  );
}
