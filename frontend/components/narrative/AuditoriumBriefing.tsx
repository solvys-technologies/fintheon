// [claude-code 2026-03-23] MiroFish briefing panel — agent reasoning synthesis
import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, FileText } from 'lucide-react';
import type { MiroFishBriefing } from '../../types/mirofish';

interface AuditoriumBriefingProps {
  briefing: MiroFishBriefing | null;
  isLoading?: boolean;
}

export function AuditoriumBriefing({ briefing, isLoading }: AuditoriumBriefingProps) {
  const [expanded, setExpanded] = useState(true);

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

  if (!briefing) {
    return (
      <div className="rounded border border-[var(--fintheon-border)]/10 bg-[var(--fintheon-surface)]/20 p-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--fintheon-muted)]/20" />
        <span className="text-[10px] text-[var(--fintheon-muted)]/30">
          Run simulation to generate briefing
        </span>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--fintheon-border)]/15 bg-[var(--fintheon-surface)]/30">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--fintheon-accent)]/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[var(--fintheon-accent)]/60" />
          <span className="text-[10px] font-mono font-bold text-[var(--fintheon-accent)]/70 uppercase tracking-wider">
            MiroFish Briefing
          </span>
          {briefing.riskAlerts.length > 0 && (
            <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-[var(--fintheon-severe)]/10 text-[var(--fintheon-severe)] font-mono font-bold">
              <AlertTriangle className="w-2.5 h-2.5" />
              {briefing.riskAlerts.length} ALERT{briefing.riskAlerts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/40" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--fintheon-muted)]/40" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Summary */}
          <p className="text-xs text-[var(--fintheon-text)]/80 leading-relaxed">
            {briefing.summary}
          </p>

          {/* Key Findings */}
          {briefing.keyFindings.length > 0 && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider font-mono">
                Key Findings
              </span>
              <ul className="mt-1 flex flex-col gap-1">
                {briefing.keyFindings.map((f, i) => (
                  <li key={i} className="text-[10px] text-[var(--fintheon-text)]/60 font-mono pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[var(--fintheon-accent)]/40">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Alerts */}
          {briefing.riskAlerts.length > 0 && (
            <div>
              <span className="text-[8px] text-[var(--fintheon-severe)]/60 uppercase tracking-wider font-mono">
                Risk Alerts
              </span>
              <ul className="mt-1 flex flex-col gap-1">
                {briefing.riskAlerts.map((a, i) => (
                  <li key={i} className="text-[10px] text-[var(--fintheon-neutral-severe)]/80 font-mono pl-3 relative before:content-['!'] before:absolute before:left-0 before:text-[var(--fintheon-severe)]/60 before:font-bold">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent Consensus */}
          <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono pt-1 border-t border-[var(--fintheon-border)]/5">
            {briefing.agentConsensus}
          </div>
        </div>
      )}
    </div>
  );
}
