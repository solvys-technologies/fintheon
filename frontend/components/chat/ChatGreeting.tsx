// [claude-code 2026-03-06] Extracted AnalysisGreeting from ChatInterface — greeting + suggestion chips
// [claude-code 2026-03-11] Chips now wired to skill system via onSkillSend
// [claude-code 2026-03-14] Fintheon rebrand: Dawn Dispatch/Weekly Tribune chips, Roman greetings, new agent titles
// [claude-code 2026-03-16] Shimmer greeting animation, removed border/bg/emoji from greeting area
import { useState, useEffect } from 'react';
import { BarChart3, CalendarCheck, Brain, Eye } from 'lucide-react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';

const SUGGESTION_CHIPS: { label: string; skillId: string; prompt: string; icon: typeof BarChart3 }[] = [
  { label: "Dawn Dispatch", skillId: 'mdb_report', prompt: "Run the MDB report for today's session", icon: BarChart3 },
  { label: "The Weekly Tribune", skillId: 'tott', prompt: "Give me The Weekly Tribune summary", icon: CalendarCheck },
  { label: "Psych Eval", skillId: 'psych_eval', prompt: "Run a full psych eval on my recent trading", icon: Brain },
  { label: "Update my Blindspots", skillId: 'blindspots', prompt: "Update and review my trading blindspots", icon: Eye },
];

function getGreeting(traderName?: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Ave, ${traderName || 'Trader'}. The markets stir.`;
  if (hour <= 17) return 'The Forum is active. What needs our attention?';
  return "The day's battles are done. What of the next conquest?";
}

interface ChatGreetingProps {
  onSend: (msg: string) => void;
  onSkillSend?: (skillId: string, msg: string) => void;
  isLoading: boolean;
}

export function ChatGreeting({ onSend, onSkillSend, isLoading }: ChatGreetingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  let activeAgent: { name: string; icon: string; sector: string; description: string } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useFintheonAgents();
    activeAgent = ctx.activeAgent;
  } catch {
    // Provider not mounted yet — fallback
  }

  const agent = activeAgent || { name: 'Harper-Opus', icon: 'H', sector: 'CAO', description: 'Chief Analyst Officer — executive strategy and oversight' };
  const greeting = getGreeting();

  const getSubtitle = () => {
    switch (agent.name) {
      case 'Harper-Opus': return "What needs orchestrating today?";
      case 'Oracle': return "What patterns shall we divine?";
      case 'Feucht': return "What exposure needs attention?";
      case 'Consul': return "What shall we analyze?";
      case 'Herald': return "What signals are you tracking?";
      default: return "What needs orchestrating today?";
    }
  };

  const handleChipClick = (chip: typeof SUGGESTION_CHIPS[number]) => {
    if (onSkillSend) {
      onSkillSend(chip.skillId, chip.prompt);
    } else {
      onSend(chip.prompt);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 max-w-[580px] mx-auto w-full">
      {/* Agent name — large, centered */}
      <div className="flex flex-col items-center gap-2.5">
        <h2 className="text-[22px] font-semibold text-white tracking-tight">{agent.name}</h2>

        {/* Anthropic model badge */}
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16.98 3.404L14.592 9.62h-5.18L7.02 3.404C6.572 2.222 7.452 1 8.712 1h6.576c1.26 0 2.14 1.222 1.692 2.404zM9.412 9.62L4.56 22.098C4.088 23.334 2.452 23.54 1.7 22.462L0 20l9.412-10.38zm5.176 0L19.44 22.098c.472 1.236 2.108 1.442 2.86.364L24 20 14.588 9.62z" fill="#D97757"/>
          </svg>
          <span className="text-[12px] font-medium" style={{ color: '#D97757' }}>
            Claude Opus 4.6
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-[13px] text-gray-500 mt-0.5">{getSubtitle()}</p>
      </div>

      {/* Large greeting — shimmer animation */}
      <h1
        className={[
          'text-[26px] font-bold text-white tracking-tight text-center leading-snug mt-1',
          mounted ? 'greeting-animate greeting-settle' : 'opacity-0',
        ].join(' ')}
      >
        {greeting}
      </h1>

      {/* Suggestion chips — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 w-full mt-3">
        {SUGGESTION_CHIPS.map((chip, index) => {
          const Icon = chip.icon;
          return (
            <button
              key={index}
              onClick={() => handleChipClick(chip)}
              disabled={isLoading}
              className="flex items-center gap-3 px-4 py-3.5 bg-transparent border border-white/10 fintheon-accent-border-hover disabled:opacity-50 rounded-xl text-left transition-all group"
            >
              <Icon className="w-[18px] h-[18px] text-gray-500 transition-colors shrink-0 fintheon-group-accent" />
              <span className="text-[13px] text-zinc-300 group-hover:text-white transition-colors">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
