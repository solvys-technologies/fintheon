// [claude-code 2026-04-03] In-chat tool approval card — smooth spring animations, Solvys Gold palette
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import {
  ChatCitationIcon,
  citationKindForTool,
  type ChatCitationKind,
} from "../icon-bank/ChatCitationIcon";
import type { ToolApprovalRequest } from "./hooks/useToolApprovals";

const TOOL_META: Record<
  string,
  { kind: ChatCitationKind; label: string; color: string }
> = {
  run_command: { kind: "shell", label: "Shell Command", color: "#c79f4a" },
  read_file: { kind: "file", label: "Read File", color: "#60A5FA" },
  write_file: { kind: "file", label: "Write File", color: "#F59E0B" },
  web_fetch: { kind: "web", label: "Web Fetch", color: "#34D399" },
  read_mcp_config: { kind: "mcp", label: "MCP Config", color: "#A78BFA" },
};

function getToolMeta(toolName: string) {
  return (
    TOOL_META[toolName] ?? {
      kind: citationKindForTool(toolName),
      label: toolName,
      color: "#9CA3AF",
    }
  );
}

/** Format tool input for display */
function formatInput(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "run_command" && typeof input.command === "string") {
    return input.command.length > 120
      ? input.command.slice(0, 120) + "..."
      : input.command;
  }
  if (
    (toolName === "read_file" || toolName === "write_file") &&
    typeof input.path === "string"
  ) {
    return input.path;
  }
  if (toolName === "web_fetch" && typeof input.url === "string") {
    return input.url;
  }
  if (toolName === "read_mcp_config") {
    return "Read all MCP server configs";
  }
  return JSON.stringify(input).slice(0, 120);
}

interface Props {
  approval: ToolApprovalRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

export function ToolApprovalCard({ approval, onApprove, onDeny }: Props) {
  const { approvalId, toolName, toolInput, status, decidedAt } = approval;
  const meta = getToolMeta(toolName);

  // Animation states
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Enter animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Exit animation after decision
  useEffect(() => {
    if (status !== "pending" && decidedAt) {
      const timer = setTimeout(() => setExiting(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [status, decidedAt]);

  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isDenied = status === "denied";

  const statusColor = isPending
    ? meta.color
    : isApproved
      ? "#34D399"
      : "#EF4444";
  const statusLabel = isPending
    ? "Permission Required"
    : isApproved
      ? "Approved — Permanent"
      : "Denied";

  return (
    <div
      ref={cardRef}
      style={{
        opacity: exiting ? 0 : mounted ? 1 : 0,
        transform: exiting
          ? "translateY(-8px) scale(0.97)"
          : mounted
            ? "translateY(0) scale(1)"
            : "translateY(12px) scale(0.95)",
        maxHeight: exiting ? "0px" : "200px",
        marginBottom: exiting ? "0px" : "12px",
        transition: exiting
          ? "opacity 300ms ease-out, transform 300ms ease-out, max-height 400ms ease-out 200ms, margin-bottom 400ms ease-out 200ms"
          : "opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        overflow: "hidden",
      }}
      className="fintheon-popover-surface max-w-[82%] overflow-hidden"
      data-approval-id={approvalId}
    >
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--fintheon-bg)]/80">
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: statusColor,
              flexShrink: 0,
              animation: isPending ? "p 1.5s ease-in-out infinite" : "none",
            }}
          />
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2 bg-[#0b0b08]">
          {/* Tool badge + description */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
            >
              <ChatCitationIcon kind={meta.kind} size={22} title={meta.label} />
              {meta.label}
            </span>
          </div>

          {/* Tool input preview */}
          <pre className="text-[11px] text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap break-all mb-2 max-h-[60px] overflow-y-auto">
            {formatInput(toolName, toolInput)}
          </pre>

          {/* Action buttons — only when pending */}
          {isPending && (
            <div
              className="flex items-center gap-2 pt-1"
              style={{
                opacity: mounted ? 1 : 0,
                transition: "opacity 200ms ease 200ms",
              }}
            >
              <button
                onClick={() => onApprove(approvalId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  backgroundColor: `${meta.color}20`,
                  color: meta.color,
                  border: `1px solid ${meta.color}30`,
                }}
              >
                <ShieldCheck size={12} />
                Approve
              </button>
              <button
                onClick={() => onDeny(approvalId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 transition-all active:scale-[0.97]"
              >
                <ShieldX size={12} />
                Deny
              </button>
              <span className="text-[9px] text-zinc-600 ml-auto">
                approval is permanent
              </span>
            </div>
          )}

          {/* Decision confirmation */}
          {!isPending && (
            <div
              className="flex items-center gap-2 pt-1"
              style={{
                opacity: 1,
                animation: "fadeSlideIn 0.2s ease-out forwards",
              }}
            >
              {isApproved && (
                <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  {toolName} permanently approved
                </span>
              )}
              {isDenied && (
                <span className="text-[10px] text-red-400/80 flex items-center gap-1">
                  <ShieldX size={11} />
                  Permission denied
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
