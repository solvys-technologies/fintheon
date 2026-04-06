// [claude-code 2026-04-05] T2: Chat icons moved to Consilium bar — event-driven new chat, run report, load session
// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
// S13-T1: Renamed to ChatSidebar, surfaceId=chat
import { useCallback, useState, useEffect } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { FintheonThread } from './FintheonThread';
import { FintheonComposer } from './FintheonComposer';
import { CognitionPanel } from './CognitionPanel';

function ChatSidebarInner({ lastError, lastRequestId, thinkHarder, setThinkHarder, conversationId, setConversationId, clearConversationId }: { lastError: string | null; lastRequestId: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; conversationId: string | undefined; setConversationId: (id: string) => void; clearConversationId: () => void }) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  // Listen for toolbar events dispatched from ConsiliumHub icons
  useEffect(() => {
    const onNewChat = () => clearConversationId();
    const onRunReport = () => { if (!isRunning) handleSend('Run the MDB report'); };
    const onLoadSession = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) setConversationId(id);
    };

    window.addEventListener('fintheon:chat-new', onNewChat);
    window.addEventListener('fintheon:chat-run-report', onRunReport);
    window.addEventListener('fintheon:chat-load-session', onLoadSession);
    return () => {
      window.removeEventListener('fintheon:chat-new', onNewChat);
      window.removeEventListener('fintheon:chat-run-report', onRunReport);
      window.removeEventListener('fintheon:chat-load-session', onLoadSession);
    };
  }, [clearConversationId, handleSend, isRunning, setConversationId]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.07),transparent_38%),#070704]">
      <div className="flex-1 min-h-0 relative">
        <FintheonThread
          onSend={handleSend}
          isLoading={isRunning}
          agentName={activeAgent?.name}
          lastError={lastError}
          lastRequestId={lastRequestId}
          compact
        />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10" style={{ height: '40%', background: 'linear-gradient(to bottom, transparent 0%, var(--fintheon-bg) 100%)' }} />
      </div>
      {/* Agent plan / cognition inline in sidebar — shows task progress when streaming */}
      {lastRequestId && isRunning && (
        <div className="px-3 pb-2">
          <CognitionPanel requestId={lastRequestId} isStreaming={isRunning} />
        </div>
      )}
      <div className="relative z-20 shrink-0">
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
    </div>
  );
}

export function ChatSidebar() {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
  const { runtime, conversationId, setConversationId, clearConversationId, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'chat');

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatSidebarInner lastError={lastError} lastRequestId={lastRequestId ?? null} thinkHarder={thinkHarder} setThinkHarder={setThinkHarder} conversationId={conversationId} setConversationId={setConversationId} clearConversationId={clearConversationId} />
    </AssistantRuntimeProvider>
  );
}
