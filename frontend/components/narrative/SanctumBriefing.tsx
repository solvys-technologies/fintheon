// [claude-code 2026-03-28] S4-T3: Enhanced briefing display — structured sections, severity indicators, accent borders
// [claude-code 2026-03-23] AgentDesk briefing panel — agent reasoning synthesis
// [claude-code 2026-04-17] Slop-fallback rendering: compact empty-state with ArbitrumChamber trigger link when backend emits SLOP_FALLBACK
import type { AgentDeskBriefing } from "../../types/agent-desk";

const SLOP_FALLBACK = "No new agentic updates. Trigger an update in ArbitrumChamber.";

interface SanctumBriefingProps {
  briefing: AgentDeskBriefing | null;
  isLoading?: boolean;
  noBorder?: boolean;
  onTriggerArbitrumChamber?: () => void;
  revisionStatus?: string | null;
  revisionChecking?: boolean;
}

export function SanctumBriefing({
  briefing,
  isLoading,
  noBorder,
  onTriggerArbitrumChamber,
  revisionStatus,
  revisionChecking,
}: SanctumBriefingProps) {
  if (isLoading) {
    return (
      <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-surface)]/30 p-4">
        <div className="flex items-center gap-2 text-[10px] text-[var(--fintheon-muted)]/40">
          <div className="w-3 h-3 rounded-full bg-[var(--fintheon-accent)]/20 animate-pulse" />
          Generating briefing...
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const isSlop = briefing.summary === SLOP_FALLBACK;

  if (isSlop) {
    return (
      <div
        className={`rounded bg-[var(--fintheon-surface)]/30 px-5 py-4 ${noBorder ? "" : "border border-[var(--fintheon-accent)]/10"}`}
      >
        <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">
          Briefing
        </span>
        <p className="text-[11px] text-[var(--fintheon-text)]/60 leading-relaxed">
          {SLOP_FALLBACK}
        </p>
        {onTriggerArbitrumChamber && (
          <button
            type="button"
            onClick={onTriggerArbitrumChamber}
            className="mt-3 text-[10px] uppercase tracking-wider text-[var(--fintheon-accent)] hover:text-[var(--fintheon-text)] transition-colors"
          >
            Trigger ArbitrumChamber →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded bg-[var(--fintheon-surface)]/30 overflow-hidden">
      {/* Revision status bar — shown after refresh check */}
      {(revisionChecking || revisionStatus) && (
        <div
          className={`px-5 py-2.5 border-b ${revisionChecking ? "border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/5" : "border-[var(--fintheon-accent)]/10"}`}
        >
          {revisionChecking ? (
            <span className="text-[10px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">
              [CHECKING FOR UPDATES...]
            </span>
          ) : (
            <span className="text-[10px] text-[var(--fintheon-text)]/45 leading-relaxed">
              {revisionStatus}
            </span>
          )}
        </div>
      )}
      {/* Key Findings */}
      {(briefing.keyFindings?.length ?? 0) > 0 && (
        <div
          className="px-5 py-3 border-t border-[var(--fintheon-border)]/10"
          style={noBorder ? { borderTop: "none" } : undefined}
        >
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">
            Key Findings
          </span>
          <div className="flex flex-col gap-1.5">
            {(briefing.keyFindings ?? []).map((finding, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] font-mono text-[var(--fintheon-accent)]/60 w-4 shrink-0">
                  {i + 1}.
                </span>
                <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">
                  {finding}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {(briefing.riskAlerts?.length ?? 0) > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">
            Risk Alerts
          </span>
          <div className="flex flex-col gap-1.5">
            {(briefing.riskAlerts ?? []).map((alert, i) => {
              const isSevere = /elevated|extreme|critical|high.heat/i.test(
                alert,
              );
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 pl-2 border border-red-500/15 rounded"
                  style={{
                    borderLeftColor: isSevere
                      ? "var(--fintheon-severe)"
                      : "var(--fintheon-neutral-severe)",
                  }}
                >
                  <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">
                    {alert}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Harper Analysis — AI-generated narrative breakdown (suppressed when fallback fires) */}
      {briefing.harperAnalysis && briefing.harperAnalysis !== SLOP_FALLBACK && (
        <div className="px-5 py-4 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-accent)]/50 uppercase tracking-wider block mb-2">
            Harper Analysis
          </span>
          <div className="text-[11px] text-[var(--fintheon-text)]/80 leading-relaxed whitespace-pre-line">
            {briefing.harperAnalysis}
          </div>
        </div>
      )}

      {/* Consensus — summary text sits beneath consensus card */}
      <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
        {briefing.agentConsensus && (
          <div className="inline-block px-3 py-1.5 rounded bg-[var(--fintheon-accent)]/8 mb-2">
            <span className="text-[9px] text-[var(--fintheon-accent)]/70">
              {briefing.agentConsensus}
            </span>
          </div>
        )}
        <p className="text-[11px] text-[var(--fintheon-text)]/80 leading-relaxed">
          {briefing.summary}
        </p>
      </div>
    </div>
  );
}
