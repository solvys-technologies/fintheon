// [claude-code 2026-04-04] T2: Chat icons moved to Consilium bar — event-driven new chat, run report, toggle history
// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
// S13-T1: Renamed to ChatSidebar, surfaceId=chat
import { useCallback, useState, useEffect } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { FintheonThread } from './FintheonThread';
import { FintheonComposer } from './FintheonComposer';
import { CognitionPanel } from './CognitionPanel';
import { SessionsModal } from './SessionsModal';

function ChatSidebarInner({ lastError, lastRequestId, thinkHarder, setThinkHarder, conversationId, setConversationId, clearConversationId }: { lastError: string | null; lastRequestId: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; conversationId: string | undefined; setConversationId: (id: string) => void; clearConversationId: () => void }) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  // Listen for toolbar events dispatched from ConsiliumHub icons
  useEffect(() => {
    const onNewChat = () => clearConversationId();
    const onRunReport = () => { if (!isRunning) handleSend('Run the MDB report'); };
    const onToggleHistory = () => setShowSessions(v => !v);

    window.addEventListener('fintheon:chat-new', onNewChat);
    window.addEventListener('fintheon:chat-run-report', onRunReport);
    window.addEventListener('fintheon:chat-toggle-history', onToggleHistory);
    return () => {
      window.removeEventListener('fintheon:chat-new', onNewChat);
      window.removeEventListener('fintheon:chat-run-report', onRunReport);
      window.removeEventListener('fintheon:chat-toggle-history', onToggleHistory);
    };
  }, [clearConversationId, handleSend, isRunning]);

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

      <SessionsModal
        isOpen={showSessions}
        onClose={() => setShowSessions(false)}
        onSelectSession={(id) => { setConversationId(id); setShowSessions(false); }}
        onNewSession={() => { clearConversationId(); setShowSessions(false); }}
        currentConversationId={conversationId}
      />
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
