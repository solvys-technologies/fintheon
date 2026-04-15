// [claude-code 2026-04-15] Floating KPI overlay for DAG deliberation — fuse shimmer + consensus metrics
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { HermesAgentId } from "../../../backend-hono/src/services/agent-bus/types";
import {
  deriveConsensusKPIs,
  type AggregateKPIs,
} from "../../lib/agentStreamParser";

interface AgentOutput {
  agentId: HermesAgentId;
  text: string;
  status: "pending" | "streaming" | "complete" | "error";
}

interface DeliberationKPIOverlayProps {
  agentOutputs: Record<string, AgentOutput>;
  dagStatus: "idle" | "dispatching" | "running" | "complete" | "error";
}

function biasColor(bias: AggregateKPIs["directionalBias"]): string {
  if (bias === "Bullish") return "var(--fintheon-low, #22c55e)";
  if (bias === "Bearish") return "var(--fintheon-severe, #ef4444)";
  return "var(--fintheon-accent, #c79f4a)";
}

function postureColor(posture: AggregateKPIs["riskPosture"]): string {
  if (posture === "Defensive") return "var(--fintheon-severe, #ef4444)";
  if (posture === "Aggressive") return "var(--fintheon-low, #22c55e)";
  return "var(--fintheon-accent, #c79f4a)";
}

function consensusColor(pct: number): string {
  if (pct >= 75) return "var(--fintheon-low, #22c55e)";
  if (pct >= 50) return "var(--fintheon-accent, #c79f4a)";
  return "var(--fintheon-muted, #888)";
}

function FuseBar({ color }: { color: string }) {
  return (
    <div
      className="w-[3px] h-7 rounded-full overflow-hidden shrink-0"
      style={{
        background: `linear-gradient(to top, ${color}20, ${color}, ${color}20)`,
        backgroundSize: "100% 200%",
        animation: "fuse-shimmer 2s ease-in-out infinite",
      }}
    />
  );
}

export function DeliberationKPIOverlay({
  agentOutputs,
  dagStatus,
}: DeliberationKPIOverlayProps) {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  const kpis = useMemo(() => deriveConsensusKPIs(agentOutputs), [agentOutputs]);

  const isDone = dagStatus === "complete" || dagStatus === "error";

  // Fade out 2s after DAG completes
  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(() => setExiting(true), 2000);
    return () => clearTimeout(t);
  }, [isDone]);

  // Unmount after exit animation
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(t);
  }, [exiting]);

  if (!visible) return null;

  const overlay = (
    <div
      className="fixed top-[180px] right-4 z-50 w-[220px] rounded-lg border border-[var(--fintheon-accent)]/20 bg-[#0a0906]/95 backdrop-blur-sm"
      style={{
        boxShadow: "0 0 12px rgba(212, 175, 55, 0.2)",
        animation: exiting
          ? "kpi-overlay-exit 250ms ease-in forwards"
          : "kpi-overlay-enter 300ms ease-out",
      }}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 border-b border-[var(--fintheon-accent)]/10">
        <span className="text-[8px] text-[var(--fintheon-accent)]/60 uppercase tracking-[0.2em] font-semibold">
          Agent Consensus
        </span>
      </div>

      {/* KPI Rows */}
      <div className="px-3 py-2 flex flex-col gap-2.5">
        {/* Consensus Strength */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[7px] text-[#f0ead6]/30 uppercase tracking-wider block">
              Consensus
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: consensusColor(kpis.consensusStrength) }}
            >
              {kpis.consensusStrength}%
            </span>
          </div>
          <FuseBar color={consensusColor(kpis.consensusStrength)} />
        </div>

        {/* Directional Bias */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[7px] text-[#f0ead6]/30 uppercase tracking-wider block">
              Direction
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: biasColor(kpis.directionalBias) }}
            >
              {kpis.directionalBias}
            </span>
          </div>
          <FuseBar color={biasColor(kpis.directionalBias)} />
        </div>

        {/* Risk Posture */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-[7px] text-[#f0ead6]/30 uppercase tracking-wider block">
              Risk Posture
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: postureColor(kpis.riskPosture) }}
            >
              {kpis.riskPosture}
            </span>
          </div>
          <FuseBar color={postureColor(kpis.riskPosture)} />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
