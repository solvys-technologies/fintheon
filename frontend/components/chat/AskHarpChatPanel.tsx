// [claude-code 2026-03-13] Hermes migration: useOpenClawRuntime -> useHermesRuntime
// [claude-code 2026-03-10] AskHarpChatPanel — now uses PulseComposer (which wraps PromptBox)
import { useCallback, useState } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { usePulseAgents } from '../../contexts/PulseAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { PulseThread } from './PulseThread';
import { PulseComposer } from './PulseComposer';

function AskHarpInner({ lastError, lastRequestId, thinkHarder, setThinkHarder }: { lastError: string | null; lastRequestId: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void }) {
  const { activeAgent } = usePulseAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.07),transparent_38%),#070704]">
      <PulseThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
      />
      <PulseComposer
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={setActiveSkill}
        showSkills={showSkills}
        onToggleSkills={() => setShowSkills((v) => !v)}
      />
    </div>
  );
}

export function AskHarpChatPanel() {
  const { activeAgent } = usePulseAgents();
  const [thinkHarder, setThinkHarder] = useState(true);
  const { runtime, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'askharp');

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskHarpInner lastError={lastError} lastRequestId={lastRequestId ?? null} thinkHarder={thinkHarder} setThinkHarder={setThinkHarder} />
    </AssistantRuntimeProvider>
  );
}
