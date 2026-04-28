// [claude-code 2026-04-18] Absolute API_BASE — /api/proposals/chart was file://-resolved under Electron.
// [claude-code 2026-03-28] S7: Added Scorecards toggle view inside Proposals panel
// [claude-code 2026-03-20] 8b: Proposals tab — Human/Agentic toggle + Kalshi tracking
// [claude-code 2026-03-20] Theme fix: zinc → fintheon gold/cream palette
import { useState, useEffect, useCallback } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
import {
  Target,
  Diff,
  TrendingDown,
  Loader2,
  AlertTriangle,
  Crosshair,
  User,
  Bot,
  ToggleLeft,
  ToggleRight,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import { ModelGlossary } from "./ModelGlossary";
import { AgentScorecard } from "../consilium/AgentScorecard";
import { RiskSignalCards } from "../narrative/RiskSignalCards";

type PanelView = "proposals" | "scorecards" | "risk-signals";
type ExecutionMode = "human" | "agentic";

interface ActiveProposal {
  id: string;
  instrument: string;
  direction: "long" | "short" | "flat";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number[];
  confidence: number;
  strategyName: string;
  rationale: string;
  createdAt: string;
}

const STRATEGY_LABELS: Record<string, string> = {
  MORNING_FLUSH: "Morning Flush",
  LUNCH_FLUSH: "Lunch Flush",
  POWER_HOUR_FLUSH: "Power Hour Flush",
  VIX_FIX_22: "VIX Fix 22",
  FORTY_FORTY_CLUB: "40/40 Club",
  MOMENTUM: "Momentum",
  CHARGED_RIPPERS: "Charged Rippers",
  MEAN_REVERSION: "Mean Reversion",
  DISCRETIONARY: "Discretionary",
  PLAYBOOK_SWEEP_RECLAIM: "Playbook Sweep",
};

export function ProposalWidget() {
  const backend = useBackend();
  const [panelView, setPanelView] = useState<PanelView>("proposals");
  const [proposal, setProposal] = useState<ActiveProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [charting, setCharting] = useState(false);
  const [chartStatus, setChartStatus] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => {
    try {
      return (
        (localStorage.getItem(
          "fintheon:proposal-execution-mode",
        ) as ExecutionMode) || "human"
      );
    } catch {
      return "human";
    }
  });

  const toggleMode = () => {
    const next: ExecutionMode = executionMode === "human" ? "agentic" : "human";
    setExecutionMode(next);
    try {
      localStorage.setItem("fintheon:proposal-execution-mode", next);
    } catch {}
  };

  const fetchLatestProposal = useCallback(async () => {
    try {
      const res = await backend.autopilot.getPendingProposals();
      if (res.proposals?.length > 0) {
        const p = res.proposals[0];
        setProposal({
          id: p.id,
          instrument: p.instrument,
          direction: p.direction,
          entryPrice: p.entryPrice,
          stopLoss: p.stopLoss,
          takeProfit: p.takeProfit,
          confidence: p.confidence,
          strategyName: p.strategyName,
          rationale: p.rationale,
          createdAt: p.createdAt,
        });
      } else {
        setProposal(null);
      }
    } catch (err) {
      console.warn("[Proposals] Failed to fetch proposals:", err);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    fetchLatestProposal();
    const interval = setInterval(fetchLatestProposal, 30000);
    return () => clearInterval(interval);
  }, [fetchLatestProposal]);

  const handleChartIt = async () => {
    if (!proposal || charting) return;
    setCharting(true);
    setChartStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/proposals/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: proposal.instrument,
          direction: proposal.direction,
          entry: proposal.entryPrice,
          stopLoss: proposal.stopLoss,
          takeProfit: proposal.takeProfit?.[0],
        }),
      });
      const data = await res.json();
      if (data.blackout) {
        setChartStatus("Blackout period active (8:30a-12p EST)");
      } else if (data.success) {
        setChartStatus("Charted on TopStepX");
      } else {
        setChartStatus(data.error || "Chart failed");
      }
    } catch {
      setChartStatus("Failed to connect");
    } finally {
      setCharting(false);
    }
  };

  const isLong = proposal?.direction === "long";
  const isShort = proposal?.direction === "short";

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header with view toggle + execution mode */}
      <div className="flex flex-col border-b border-[#c79f4a]/10">
        {/* View toggle: Proposals / Scorecards */}
        <div className="flex items-center px-4 pt-3 pb-2 gap-1">
          <button
            onClick={() => setPanelView("proposals")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              panelView === "proposals"
                ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30"
                : "text-[var(--fintheon-text)]/30 border border-transparent hover:text-[var(--fintheon-text)]/50 hover:bg-[var(--fintheon-accent)]/5"
            }`}
          >
            <Target className="w-3 h-3" />
            Proposals
          </button>
          <button
            onClick={() => setPanelView("scorecards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              panelView === "scorecards"
                ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30"
                : "text-[var(--fintheon-text)]/30 border border-transparent hover:text-[var(--fintheon-text)]/50 hover:bg-[var(--fintheon-accent)]/5"
            }`}
          >
            <Trophy className="w-3 h-3" />
            Scorecards
          </button>
          <button
            onClick={() => setPanelView("risk-signals")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              panelView === "risk-signals"
                ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30"
                : "text-[var(--fintheon-text)]/30 border border-transparent hover:text-[var(--fintheon-text)]/50 hover:bg-[var(--fintheon-accent)]/5"
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            Signals
          </button>
          <div className="flex-1" />
          {panelView === "proposals" && (
            <button
              onClick={toggleMode}
              className="flex items-center gap-1 px-2 py-1 rounded-full border transition-all text-[9px] font-semibold"
              style={{
                borderColor:
                  executionMode === "agentic"
                    ? "rgba(52, 211, 153, 0.4)"
                    : "rgba(199, 159, 74, 0.3)",
                backgroundColor:
                  executionMode === "agentic"
                    ? "rgba(52, 211, 153, 0.08)"
                    : "rgba(199, 159, 74, 0.05)",
              }}
              title={
                executionMode === "human"
                  ? "Display only — you execute manually"
                  : "Auto-execute via API (with confirmation)"
              }
            >
              {executionMode === "human" ? (
                <>
                  <User className="w-3 h-3 text-[var(--fintheon-accent)]" />
                  <span className="text-[var(--fintheon-accent)]">Human</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Agentic</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scorecards view */}
      {panelView === "scorecards" && (
        <div className="flex-1 overflow-y-auto">
          <AgentScorecard />
        </div>
      )}

      {/* Risk Signals view (S16-T3) */}
      {panelView === "risk-signals" && (
        <div className="flex-1 overflow-y-auto px-4">
          <RiskSignalCards compact />
        </div>
      )}

      {/* Proposals view */}
      {panelView === "proposals" && (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Execution mode banner */}
            {executionMode === "agentic" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Agentic mode — proposals auto-execute via Kalshi API with
                  confirmation toast
                </span>
              </div>
            )}

                  {/* Active Proposal Card */}
              <div>
                <div className="text-[10px] text-[var(--fintheon-text)]/40 uppercase tracking-[0.2em] font-semibold mb-2">
                  Active Proposal
                </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-[var(--fintheon-accent)]/40 animate-spin" />
                </div>
              ) : !proposal ? (
                <div className="border border-[var(--fintheon-accent)]/15 rounded-lg p-6 text-center">
                  <AlertTriangle className="w-5 h-5 text-[var(--fintheon-accent)]/40 mx-auto mb-2" />
                  <div className="text-[11px] text-[var(--fintheon-text)]/40">
                    No active proposals
                  </div>
                  <div className="text-[10px] text-[var(--fintheon-text)]/30 mt-1">
                    Proposals are generated by the Autopilot pipeline
                  </div>
                </div>
              ) : (
                <div className="border border-[var(--fintheon-accent)]/30 rounded-lg bg-[var(--fintheon-surface)] overflow-hidden">
                  {/* Proposal header row */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-[var(--fintheon-accent)]">
                        {proposal.instrument}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                          isLong
                            ? "text-green-400 bg-green-500/10 border-green-500/30"
                            : isShort
                              ? "text-red-400 bg-red-500/10 border-red-500/30"
                              : "text-[var(--fintheon-text)]/40 bg-[var(--fintheon-text)]/5 border-[var(--fintheon-text)]/15"
                        }`}
                      >
                        {proposal.direction.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isLong ? (
                        <Diff className="w-3.5 h-3.5 text-green-400" />
                      ) : isShort ? (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      ) : null}
                      <span
                        className={`text-sm font-bold ${
                          proposal.confidence >= 70
                            ? "text-green-400"
                            : proposal.confidence >= 50
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {proposal.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Trade levels grid */}
                  <div className="grid grid-cols-3 divide-x divide-[var(--fintheon-accent)]/10 border-b border-[var(--fintheon-accent)]/10">
                    <div className="px-3 py-2">
                      <div className="text-[9px] text-[var(--fintheon-text)]/30 uppercase">
                        Entry
                      </div>
                      <div className="text-[12px] font-mono text-[var(--fintheon-text)]">
                        {proposal.entryPrice?.toFixed(2) || "Market"}
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[9px] text-[var(--fintheon-text)]/30 uppercase">
                        Stop
                      </div>
                      <div className="text-[12px] font-mono text-red-400">
                        {proposal.stopLoss?.toFixed(2) || "N/A"}
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[9px] text-[var(--fintheon-text)]/30 uppercase">
                        Target
                      </div>
                      <div className="text-[12px] font-mono text-green-400">
                        {proposal.takeProfit?.[0]?.toFixed(2) || "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Strategy + rationale */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="text-[10px] text-[var(--fintheon-text)]/40">
                      <span className="text-[var(--fintheon-text)]/30">Strategy:</span>{" "}
                      {STRATEGY_LABELS[proposal.strategyName] ||
                        proposal.strategyName}
                    </div>
                    <p className="text-[10px] text-[var(--fintheon-text)]/40 leading-relaxed line-clamp-3">
                      {proposal.rationale}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-3">
                    {executionMode === "human" ? (
                      <button
                        type="button"
                        onClick={handleChartIt}
                        disabled={charting}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] text-[11px] font-semibold hover:bg-[var(--fintheon-accent)]/20 transition-colors disabled:opacity-50"
                      >
                        {charting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Crosshair className="w-3.5 h-3.5" />
                        )}
                        {charting ? "Charting..." : "Chart It"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleChartIt}
                        disabled={charting}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {charting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" />
                        )}
                        {charting ? "Executing..." : "Auto-Execute"}
                      </button>
                    )}
                    {chartStatus && (
                      <div className="text-[9px] text-[var(--fintheon-text)]/30 text-center mt-1.5">
                        {chartStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Model Glossary */}
            <ModelGlossary />
          </div>
        </>
      )}
    </div>
  );
}
