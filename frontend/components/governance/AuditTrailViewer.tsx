import { useState } from "react";
import {
  useAuditLog,
  type AuditRecord,
  type AuditQueryFilters,
} from "../../hooks/useAuditLog";

interface AuditTrailViewerProps {
  limit?: number;
}

function DecisionBadge({ decision }: { decision: AuditRecord["decision"] }) {
  const styles: Record<AuditRecord["decision"], string> = {
    approved: "text-[#c79f4a] border-[#c79f4a]/40 bg-[#c79f4a]/10",
    denied: "text-red-400 border-red-400/40 bg-red-400/10",
    timed_out: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  };
  const labels: Record<AuditRecord["decision"], string> = {
    approved: "approved",
    denied: "denied",
    timed_out: "timed out",
  };
  return (
    <span
      className={`text-xs font-mono border rounded px-1.5 py-0.5 whitespace-nowrap ${styles[decision]}`}
    >
      {labels[decision]}
    </span>
  );
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AuditTrailViewer({ limit = 20 }: AuditTrailViewerProps) {
  const [page, setPage] = useState(0);
  const filters: AuditQueryFilters = { limit, offset: page * limit };
  const { rows, total, isLoading, error, refetch } = useAuditLog(filters);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (error) {
    return (
      <div className="rounded border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center justify-between">
        <span className="text-red-400/80 text-sm">
          Failed to load audit trail
        </span>
        <button
          onClick={refetch}
          className="text-xs text-[#c79f4a] hover:underline transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-[#c79f4a]/20 bg-[#050402]/80 backdrop-blur-md overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_6rem_8rem_7rem] px-4 py-2 border-b border-[#c79f4a]/20 text-[#f0ead6]/30 text-xs uppercase tracking-wide">
        <span>Timestamp</span>
        <span>Agent</span>
        <span>Tool</span>
        <span>Decision</span>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="animate-pulse space-y-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-[#f0ead6]/5" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-[#f0ead6]/30 text-sm">
          No audit records yet.
        </div>
      ) : (
        rows.map((row, i) => (
          <div
            key={row.id ?? i}
            className="grid grid-cols-[1fr_6rem_8rem_7rem] px-4 py-2.5 border-b border-[#c79f4a]/10 last:border-0 hover:bg-[#c79f4a]/5 transition-colors"
          >
            <span
              className="text-[#f0ead6]/50 text-xs tabular-nums"
              title={row.created_at ?? ""}
            >
              {row.created_at ? relativeTime(row.created_at) : "—"}
            </span>
            <span className="text-[#f0ead6]/70 text-xs font-mono truncate">
              {row.agent_id}
            </span>
            <span className="text-[#f0ead6]/50 text-xs font-mono truncate">
              {row.tool_name}
            </span>
            <DecisionBadge decision={row.decision} />
          </div>
        ))
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-5 px-4 py-2.5 border-t border-[#c79f4a]/20 text-[#f0ead6]/30 text-xs">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="hover:text-[#f0ead6] disabled:opacity-30 transition-colors"
        >
          ← Prev
        </button>
        <span className="tabular-nums">
          Page {page + 1} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="hover:text-[#f0ead6] disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
