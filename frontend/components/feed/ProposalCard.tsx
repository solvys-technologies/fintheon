// [claude-code 2026-03-31] S13-T2: Added TradePlanCard + TradePlanStatus integration
// [claude-code 2026-03-23] Browser Use Phase 2 — ProposalCard feed component
import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Check, X } from "lucide-react";
import type { ProposalData } from "../../types/feed";
import { TradePlanCard } from "../proposals/TradePlanCard";
import { TradePlanStatus } from "../proposals/TradePlanStatus";

const API_BASE = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

interface ProposalCardProps {
  proposal: ProposalData;
  timestamp: Date;
}

export function ProposalCard({ proposal, timestamp }: ProposalCardProps) {
  const [status, setStatus] = useState(proposal.status);
  const [expanded, setExpanded] = useState(false);

  const isLong = proposal.direction === "long";
  const risk = Math.abs(proposal.entry - proposal.stopLoss);
  const reward =
    proposal.takeProfit.length > 0
      ? Math.abs(proposal.takeProfit[0] - proposal.entry)
      : 0;
  const rrRatio = risk > 0 ? (reward / risk).toFixed(1) : "\u2014";

  const handleAcknowledge = async (action: "approved" | "rejected") => {
    try {
      await fetch(`${API_BASE}/api/proposals/${proposal.id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setStatus(action);
    } catch (err) {
      console.error("[ProposalCard] Acknowledge failed:", err);
    }
  };

  return (
    <div className="border border-[#D4AF37]/20 rounded-lg bg-[#050402] p-3 space-y-2">
      {/* Header: Direction badge + ticker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
              isLong
                ? "bg-[#22c55e]/15 text-[#22c55e]"
                : "bg-[#ef4444]/15 text-[#ef4444]"
            }`}
          >
            {isLong ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {proposal.direction}
          </span>
          <span className="text-[#f0ead6] font-mono font-semibold text-sm">
            {proposal.ticker}
          </span>
        </div>
        <span className="text-zinc-500 text-[10px] font-mono">
          {timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Price levels */}
      <div className="flex items-center gap-3 text-[11px] font-mono">
        <span className="text-[#22c55e]">E {proposal.entry.toFixed(1)}</span>
        <span className="text-[#ef4444]">S {proposal.stopLoss.toFixed(1)}</span>
        {proposal.takeProfit.map((tp, i) => (
          <span key={i} className="text-[#3b82f6]">
            T{i + 1} {tp.toFixed(1)}
          </span>
        ))}
        <span className="text-[#D4AF37] ml-auto">{rrRatio}R</span>
      </div>

      {/* Screenshot thumbnail */}
      {proposal.screenshotUrl && (
        <button onClick={() => setExpanded(!expanded)} className="w-full">
          <img
            src={proposal.screenshotUrl}
            alt="Chart"
            className={`rounded border border-zinc-800 w-full ${expanded ? "max-h-96" : "max-h-20"} object-contain transition-all`}
          />
        </button>
      )}

      {/* Trade Plan */}
      {proposal.tradePlan ? (
        <TradePlanCard
          proposalId={proposal.id}
          instrument={proposal.ticker}
          direction={proposal.direction}
          tradePlan={proposal.tradePlan}
        />
      ) : (
        <TradePlanStatus state="unavailable" />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-zinc-600 text-[9px] tracking-wider uppercase">
          via Hermes
        </span>
        {status === "pending" ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAcknowledge("approved")}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors"
            >
              <Check className="w-3 h-3" /> Approve
            </button>
            <button
              onClick={() => handleAcknowledge("rejected")}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
            >
              <X className="w-3 h-3" /> Reject
            </button>
          </div>
        ) : (
          <span
            className={`text-[10px] font-medium tracking-wider uppercase ${
              status === "approved"
                ? "text-[#22c55e]"
                : status === "rejected"
                  ? "text-[#ef4444]"
                  : "text-zinc-500"
            }`}
          >
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
