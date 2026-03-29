// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
import { useCallback, useState } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { FintheonThread } from './FintheonThread';
import { FintheonComposer } from './FintheonComposer';
import { CognitionPanel } from './CognitionPanel';

function AskHarpInner({ lastError, lastRequestId, thinkHarder, setThinkHarder }: { lastError: string | null; lastRequestId: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void }) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.07),transparent_38%),#070704]">
      <FintheonThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact
      />
      {/* Agent plan / cognition inline in sidebar — shows task progress when streaming */}
      {lastRequestId && isRunning && (
        <div className="px-3 pb-2">
          <CognitionPanel requestId={lastRequestId} isStreaming={isRunning} />
        </div>
      )}
      <FintheonComposer
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

export function AskHarpSidebar() {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
  const { runtime, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'askharp');

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskHarpInner lastError={lastError} lastRequestId={lastRequestId ?? null} thinkHarder={thinkHarder} setThinkHarder={setThinkHarder} />
    </AssistantRuntimeProvider>
  );
}
