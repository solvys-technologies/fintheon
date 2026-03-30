// [claude-code 2026-03-28] S8-T7: Single-pane sidebar with agent-plan inline
// [claude-code 2026-03-30] Added sessions panel toggle + session switching
import { useCallback, useState } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { Clock } from 'lucide-react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { FintheonThread } from './FintheonThread';
import { FintheonComposer } from './FintheonComposer';
import { CognitionPanel } from './CognitionPanel';
import { SessionsPanel } from './SessionsPanel';

function AskHarpInner({ lastError, lastRequestId, thinkHarder, setThinkHarder, showSessions, onToggleSessions }: { lastError: string | null; lastRequestId: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; showSessions: boolean; onToggleSessions: () => void }) {
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
      {/* Sessions toggle — top bar */}
      <div className="flex items-center justify-end px-3 pt-1.5 pb-0.5 flex-shrink-0">
        <button
          onClick={onToggleSessions}
          title="Session history"
          className={`p-1.5 rounded-md transition-colors ${showSessions ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10' : 'text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/5'}`}
        >
          <Clock size={13} />
        </button>
      </div>
      <FintheonThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact
      />
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

export interface AskHarpSidebarProps {
  onToggleSessions?: () => void;
  showSessions?: boolean;
}

export function AskHarpSidebar({ onToggleSessions, showSessions }: AskHarpSidebarProps = {}) {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
  const [localShowSessions, setLocalShowSessions] = useState(false);
  const { runtime, conversationId, setConversationId, clearConversationId, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarder, 'askharp');

  const sessionsVisible = showSessions ?? localShowSessions;
  const handleToggle = onToggleSessions ?? (() => setLocalShowSessions((v) => !v));

  const handleSelectSession = useCallback((id: string) => {
    setConversationId(id);
    // Force page reload to hydrate the selected conversation
    window.location.reload();
  }, [setConversationId]);

  const handleNewSession = useCallback(() => {
    clearConversationId();
    window.location.reload();
  }, [clearConversationId]);

  if (sessionsVisible) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.07),transparent_38%),#070704]">
        <div className="flex items-center justify-end px-3 pt-1.5 pb-0.5 flex-shrink-0">
          <button
            onClick={handleToggle}
            title="Back to chat"
            className="p-1.5 rounded-md text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 transition-colors"
          >
            <Clock size={13} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <SessionsPanel
            currentConversationId={conversationId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
          />
        </div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskHarpInner
        lastError={lastError}
        lastRequestId={lastRequestId ?? null}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        showSessions={sessionsVisible}
        onToggleSessions={handleToggle}
      />
    </AssistantRuntimeProvider>
  );
}
