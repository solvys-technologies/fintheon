import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const THINKING_PHRASES = [
  'Surveying the arena...',
  'Running risk models...',
  'Reviewing the legion\'s positions...',
  'Consulting the Consilium...',
  'Analyzing macro data...',
  'Checking volatility surface...',
  'Evaluating sentiment...',
  'Processing market signals...',
  'Cross-referencing events...',
  'Calculating exposure...',
  'Mapping liquidity pockets...',
  'Tracking implied vol drift...',
  'Pricing catalyst risk...',
  'Calibrating entry zones...',
  'Stress-testing conviction...',
];

interface PulseThinkingIndicatorProps {
  isThinking: boolean;
  thinkingContent?: string;
  agentName?: string;
}

export function PulseThinkingIndicator({ isThinking, thinkingContent, agentName }: PulseThinkingIndicatorProps) {
  const [phrase, setPhrase] = useState(THINKING_PHRASES[0]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isThinking) return;
    let idx = 0;
    setPhrase(THINKING_PHRASES[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % THINKING_PHRASES.length;
      setPhrase(THINKING_PHRASES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isThinking]);

  if (!isThinking) return null;

  return (
    <div className="w-full rounded-xl px-3 py-2.5 pulse-accent-border pulse-thinking-container">
      <div className="flex items-start gap-3">
        {/* Radar pulse */}
        <div className="relative mt-0.5 h-6 w-6 flex-shrink-0">
          <div className="absolute inset-0 rounded-full pulse-radar-ring-1 pulse-thinking-ring" />
          <div className="absolute inset-[3px] rounded-full pulse-radar-ring-2 pulse-thinking-ring-inner" />
          <div className="absolute inset-[7px] rounded-full pulse-radar-dot pulse-thinking-dot" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium" style={{ color: 'var(--fintheon-accent)' }}>{phrase}</span>
            {agentName && <span className="text-[10px] text-zinc-500">({agentName})</span>}
          </div>

          {thinkingContent && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {expanded ? 'Hide thinking pane' : 'Show thinking pane'}
              </button>
              {expanded && (
                <div className="mt-1.5 max-h-[180px] overflow-y-auto border-l pl-2 text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap pulse-accent-border">
                  {thinkingContent}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .pulse-radar-ring-1 { animation: pulseRadar1 1.6s ease-out infinite; }
        .pulse-radar-ring-2 { animation: pulseRadar2 1.6s ease-out infinite; }
        .pulse-radar-dot { animation: pulseRadarDot 1.2s ease-in-out infinite; }
        @keyframes pulseRadar1 {
          0% { transform: scale(0.75); opacity: 0.9; }
          100% { transform: scale(1.25); opacity: 0.1; }
        }
        @keyframes pulseRadar2 {
          0% { transform: scale(0.8); opacity: 0.65; }
          100% { transform: scale(1.15); opacity: 0.08; }
        }
        @keyframes pulseRadarDot {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
