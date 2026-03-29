// [claude-code 2026-03-28] S4-T3: Enhanced briefing display — structured sections, severity indicators, accent borders
// [claude-code 2026-03-23] MiroShark briefing panel — agent reasoning synthesis
import type { MiroSharkBriefing } from '../../types/miroshark';

interface SanctumBriefingProps {
  briefing: MiroSharkBriefing | null;
  isLoading?: boolean;
}

export function SanctumBriefing({ briefing, isLoading }: SanctumBriefingProps) {
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

  return (
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/30 overflow-hidden">
      {/* Summary — lead paragraph */}
      <div className="px-5 py-4 border border-[var(--fintheon-accent)]/10 rounded">
        <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-1.5">Analysis</span>
        <p className="text-[11px] text-[var(--fintheon-text)]/80 leading-relaxed">
          {briefing.summary}
        </p>
      </div>

      {/* Key Findings */}
      {briefing.keyFindings.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">Key Findings</span>
          <div className="flex flex-col gap-1.5">
            {briefing.keyFindings.map((finding, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] font-mono text-[var(--fintheon-accent)]/60 w-4 shrink-0">{i + 1}.</span>
                <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">{finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {briefing.riskAlerts.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider block mb-2">Risk Alerts</span>
          <div className="flex flex-col gap-1.5">
            {briefing.riskAlerts.map((alert, i) => {
              const isSevere = /elevated|extreme|critical|high.heat/i.test(alert);
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 pl-2 border border-red-500/15 rounded"
                  style={{ borderLeftColor: isSevere ? 'var(--fintheon-severe)' : 'var(--fintheon-neutral-severe)' }}
                >
                  <span className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">{alert}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Consensus */}
      {briefing.agentConsensus && (
        <div className="px-5 py-3 border-t border-[var(--fintheon-border)]/10">
          <div className="inline-block px-3 py-1.5 rounded bg-[var(--fintheon-accent)]/8">
            <span className="text-[9px] text-[var(--fintheon-accent)]/70">{briefing.agentConsensus}</span>
          </div>
        </div>
      )}
    </div>
  );
}
