// [claude-code 2026-03-22] Track 3: Multi-select agent filter dropdown for Consilium
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AGENT_MAP, type BoardroomAgent } from './AgentBadge';

interface AgentFilterDropdownProps {
  agents: BoardroomAgent[];
  selected: BoardroomAgent[];
  onChange: (agents: BoardroomAgent[]) => void;
}

/** Extract hex color from the Tailwind accentClass string (e.g. 'text-[#c79f4a]' → '#c79f4a') */
function extractHex(accentClass: string): string {
  const match = accentClass.match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : '#6b6040';
}

function getButtonLabel(selected: BoardroomAgent[]): string {
  if (selected.length === 0) return 'All Agents';
  if (selected.length === 1) return AGENT_MAP[selected[0]]?.label ?? selected[0];
  if (selected.length === 2) {
    return selected.map((a) => AGENT_MAP[a]?.label ?? a).join(', ');
  }
  return `${selected.length} agents`;
}

export function AgentFilterDropdown({ agents, selected, onChange }: AgentFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (agent: BoardroomAgent) => {
    if (selected.includes(agent)) {
      onChange(selected.filter((a) => a !== agent));
    } else {
      onChange([...selected, agent]);
    }
  };

  const clearAll = () => onChange([]);

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          hasSelection
            ? 'border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]'
            : 'border-[var(--fintheon-accent)]/15 text-[var(--fintheon-text)]/50 hover:border-[var(--fintheon-accent)]/30 hover:text-[var(--fintheon-text)]/70'
        }`}
      >
        <span className="whitespace-nowrap">{getButtonLabel(selected)}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] py-1 shadow-xl">
          {/* Clear / select-all row */}
          {hasSelection && (
            <>
              <button
                onClick={clearAll}
                className="w-full px-3 py-1.5 text-left text-[11px] text-[var(--fintheon-text)]/40 hover:text-[var(--fintheon-text)]/70 transition-colors"
              >
                Clear filters
              </button>
              <div className="h-px bg-[var(--fintheon-accent)]/10 mx-2 my-0.5" />
            </>
          )}

          {agents.map((agent) => {
            const config = AGENT_MAP[agent];
            if (!config) return null;
            const active = selected.includes(agent);
            const hex = extractHex(config.accentClass);

            return (
              <button
                key={agent}
                onClick={() => toggle(agent)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
                  active
                    ? 'bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-text)]'
                    : 'text-[var(--fintheon-text)]/50 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/80'
                }`}
              >
                {/* Colored dot */}
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ backgroundColor: hex }}
                />
                {/* Agent name */}
                <span className="font-medium flex-1">{config.label}</span>
                {/* Role label */}
                <span className="text-[10px] text-[var(--fintheon-text)]/30">{config.role}</span>
                {/* Check indicator */}
                {active && <Check size={12} className="text-[var(--fintheon-accent)] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
