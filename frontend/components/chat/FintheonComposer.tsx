// [claude-code 2026-03-11] T2a: clear active skill badge after send
// [claude-code 2026-03-11] T3b: MCP auto-activation when skill selected
// [claude-code 2026-03-11] T5: steer strip removed, queue chips added, always full PromptBox
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-03-22] Track 4: persona pills → PersonaDropdown, Plug2+Wrench → ToolsDropdown
import { useEffect, useState, useCallback } from 'react';
import { useThread, useThreadRuntime } from '@assistant-ui/react';
import { PromptBox } from '../ui/chatgpt-prompt-input';
import { SKILL_PREFIXES } from '../../lib/skillPrefixes';
import { SKILLS } from '../../lib/skills';
import { useVoice } from '../../contexts/VoiceContext';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useMcpConnectors } from '../../hooks/useMcpConnectors';
import { PersonaDropdown } from './PersonaDropdown';
import { ToolsDropdown } from './ToolsDropdown';
import { ProviderDropdown, useHarperProvider } from './ProviderDropdown';
import { API_BASE_URL } from './constants';

/* ------------------------------------------------------------------ */
/*  FintheonComposer                                                      */
/* ------------------------------------------------------------------ */

interface FintheonComposerProps {
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

export function FintheonComposer({
  thinkHarder,
  setThinkHarder,
  activeSkill,
  onSelectSkill,
  showSkills,
  onToggleSkills,
  lastError,
  disabledSkills: propDisabledSkills,
  compact,
}: FintheonComposerProps) {
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const [apiDisabledSkills, setApiDisabledSkills] = useState<Record<string, { reason: string }>>({});
  const voice = useVoice();
  const { activeAgent } = useFintheonAgents();
  const { servers, activeIds, toggle: toggleConnector } = useMcpConnectors();
  const { provider, setProvider } = useHarperProvider();

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
      console.error('[FintheonComposer] Failed to append message:', err);
    }
  }, [runtime, activeSkill, onSelectSkill]);

  const handleStop = useCallback(() => {
    runtime.cancelRun();
  }, [runtime]);

  const providerEl = <ProviderDropdown provider={provider} onChange={setProvider} />;
  const personaEl = <PersonaDropdown />;

  const toolsEl = (
    <ToolsDropdown
      skills={SKILLS}
      activeSkill={activeSkill}
      onSelectSkill={onSelectSkill}
      disabledSkills={mergedDisabledSkills}
      servers={servers}
      activeConnectorIds={activeIds}
      onToggleConnector={toggleConnector}
    />
  );

  return (
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
      providerSlot={providerEl}
      personaSlot={personaEl}
      toolsSlot={toolsEl}
    />
  );
}
