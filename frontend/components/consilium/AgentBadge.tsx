// [claude-code 2026-03-19] Agent identity badge for Consilium panel
import { Crown, Eye, Zap, Scroll, Megaphone, MessageCircle } from 'lucide-react';

export type BoardroomAgent = 'Harper-Hermes' | 'Oracle' | 'Feucht' | 'Consul' | 'Herald' | 'Unknown';

interface AgentConfig {
  label: string;
  role: string;
  icon: typeof Crown;
  accentClass: string;
}

const AGENT_MAP: Record<BoardroomAgent, AgentConfig> = {
  'Harper-Hermes': { label: 'Harper', role: 'CAO', icon: Crown, accentClass: 'text-[#c79f4a]' },
  'Oracle':        { label: 'Oracle', role: 'All-Seer', icon: Eye, accentClass: 'text-[#a89060]' },
  'Feucht':        { label: 'Feucht', role: 'Risk Desk', icon: Zap, accentClass: 'text-[#d4af37]' },
  'Consul':        { label: 'Consul', role: 'Fundamentals', icon: Scroll, accentClass: 'text-[#8a7a50]' },
  'Herald':        { label: 'Herald', role: 'Sentiment', icon: Megaphone, accentClass: 'text-[#b8963a]' },
  'Unknown':       { label: 'Agent', role: 'Unknown', icon: MessageCircle, accentClass: 'text-[#6b6040]' },
};

interface AgentBadgeProps {
  agent: BoardroomAgent;
  size?: 'sm' | 'md';
}

export function AgentBadge({ agent, size = 'md' }: AgentBadgeProps) {
  const config = AGENT_MAP[agent] || AGENT_MAP['Unknown'];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 16;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center justify-center rounded-full border border-[#c79f4a]/30 bg-[#0a0a00] ${size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'}`}>
        <Icon size={iconSize} className={config.accentClass} />
      </div>
      <div className="flex flex-col">
        <span className={`font-medium leading-tight ${config.accentClass} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {config.label}
        </span>
        {size === 'md' && (
          <span className="text-[10px] uppercase tracking-wider text-[#f0ead6]/40">
            {config.role}
          </span>
        )}
      </div>
    </div>
  );
}

export const AGENT_ACCENT_HEX: Record<BoardroomAgent, string> = {
  'Harper-Hermes': '#c79f4a',
  'Oracle': '#a89060',
  'Feucht': '#d4af37',
  'Consul': '#8a7a50',
  'Herald': '#b8963a',
  'Unknown': '#6b6040',
};

export { AGENT_MAP };
