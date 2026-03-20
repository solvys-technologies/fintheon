// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-03-16] Persona selector pills added above PromptBox
import { useEffect, useState, useCallback } from 'react';
import { useThread, useThreadRuntime } from '@assistant-ui/react';
import { PromptBox } from '../ui/chatgpt-prompt-input';
import { SKILL_PREFIXES } from '../../lib/skillPrefixes';
import { SKILLS } from '../../lib/skills';
import { useVoice } from '../../contexts/VoiceContext';
import { usePulseAgents, type PulseAgent } from '../../contexts/PulseAgentContext';
import { API_BASE_URL } from './constants';

/* ------------------------------------------------------------------ */
/*  Persona data for the 5 agents                                      */
/* ------------------------------------------------------------------ */

const PERSONA_META: Record<string, { label: string }> = {
  'harper-hermes': { label: 'CAO' },
  oracle:          { label: 'All-Seer' },
  feucht:          { label: 'Futures & Risk' },
  consul:          { label: 'Fundamentals' },
  herald:          { label: 'News & Sentiment' },
};

function statusColor(status: string): string {
  switch (status) {
    case 'working': return '#22c55e';
    case 'idle':    return '#eab308';
    case 'blocked': return '#ef4444';
    default:        return '#52525b';
  }
}

/* ------------------------------------------------------------------ */
/*  PersonaPill                                                        */
/* ------------------------------------------------------------------ */

function PersonaPill({ agent, isActive, onClick }: { agent: PulseAgent; isActive: boolean; onClick: () => void }) {
  const meta = PERSONA_META[agent.id] ?? { label: agent.sector };
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0',
        isActive
          ? 'border border-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/10'
          : 'border border-zinc-800/60 hover:border-zinc-700 bg-transparent',
      ].join(' ')}
    >
      {/* Status dot */}
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ backgroundColor: statusColor(agent.status) }}
      />
      {/* Name + description */}
      <span className="flex flex-col items-start leading-none">
        <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-[var(--fintheon-accent)]' : 'text-zinc-300'}`}>
          {agent.name}
        </span>
        <span className="text-[8px] text-zinc-500 mt-[1px]">{meta.label}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  PulseComposer                                                      */
/* ------------------------------------------------------------------ */

interface PulseComposerProps {
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  showSkills: boolean;
  onToggleSkills: () => void;
  lastError: string | null;
  disabledSkills?: Record<string, { reason: string }>;
  compact?: boolean;
}

export function PulseComposer({
  thinkHarder,
  setThinkHarder,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  lastError,
  disabledSkills: propDisabledSkills,
  compact,
}: PulseComposerProps) {
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const [apiDisabledSkills, setApiDisabledSkills] = useState<Record<string, { reason: string }>>({});
  const voice = useVoice();
  const { agents, activeAgent, setActiveAgent } = usePulseAgents();

  // Fetch skills from backend — merge with prop-level disabled skills
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/ai/skills`);
        if (!res.ok) return;
        const data = await res.json();
        const disabled: Record<string, { reason: string }> = {};
        for (const skill of data.skills ?? []) {
          if (!skill.enabled) {
            disabled[skill.id] = { reason: skill.reason ?? 'Disabled' };
          }
        }
        if (!cancelled) setApiDisabledSkills(disabled);
      } catch {
        // Skills endpoint not available — use prop defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const mergedDisabledSkills = { ...apiDisabledSkills, ...propDisabledSkills };

  const handleSend = useCallback((msg: string, images?: string[]) => {
    let finalText = msg;
    if (activeSkill && SKILL_PREFIXES[activeSkill]) {
      finalText = SKILL_PREFIXES[activeSkill] + '\n\n' + msg;
    }
    const content: Array<{ type: string; text?: string; image?: string }> = [
      { type: 'text', text: finalText },
    ];
    if (images?.length) {
      images.forEach((img) => content.push({ type: 'image', image: img }));
    }
    // Auto-activate MCP servers required by the active skill
    if (activeSkill) {
      const skillDef = SKILLS.find(s => s.id === activeSkill);
      if (skillDef?.mcpServers?.length) {
        try {
          const current: string[] = JSON.parse(localStorage.getItem('fintheon:mcp-active-connectors') ?? '[]');
          const merged = [...new Set([...current, ...skillDef.mcpServers])];
          localStorage.setItem('fintheon:mcp-active-connectors', JSON.stringify(merged));
        } catch { /* ignore */ }
      }
    }

    try {
      runtime.append({ role: 'user', content: content as any });
      onSelectSkill(null);
    } catch (err) {
      console.error('[PulseComposer] Failed to append message:', err);
    }
  }, [runtime, activeSkill, onSelectSkill]);

  const handleStop = useCallback(() => {
    runtime.cancelRun();
  }, [runtime]);

  return (
    <div>
      {/* Persona selector row */}
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 max-w-3xl mx-auto overflow-x-auto scrollbar-none">
        {agents.map((agent) => (
          <PersonaPill
            key={agent.id}
            agent={agent}
            isActive={activeAgent?.id === agent.id}
            onClick={() => setActiveAgent(agent)}
          />
        ))}
      </div>

      <PromptBox
        onSend={handleSend}
        onStop={handleStop}
        isProcessing={isRunning}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={onSelectSkill}
        showSkills={showSkills}
        onToggleSkills={onToggleSkills}
        disabledSkills={mergedDisabledSkills}
        compact={compact}
        voiceEnabled={voice.enabled}
        voiceState={voice.runtimeState}
        onToggleVoice={voice.toggleEnabled}
      />
    </div>
  );
}
