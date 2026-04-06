// [claude-code 2026-03-29] S9-T5: Replace checkpoint sidebar with real conversation history, Take Note button
// [claude-code 2026-03-28] S8-T7: Dual-pane layout (left=conversation, right=artifacts) for Chat
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { useFintheonAgents } from '../contexts/FintheonAgentContext';
import { useHermesRuntime } from './chat/useHermesRuntime';
import { ChatHeader } from './chat/ChatHeader';
import { FintheonThread, AiLoader } from './chat/FintheonThread';
import { FintheonComposer } from './chat/FintheonComposer';
import { SKILL_PREFIXES } from '../lib/skillPrefixes';
import QuickFintheonModal from './analysis/QuickFintheonModal';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function ChatInterfaceInner({ conversationId, setConversationId, clearConversationId, lastError, thinkHarder, setThinkHarder, lastRequestId, dualPane = false }: { conversationId: string | undefined; setConversationId: (id: string) => void; clearConversationId: () => void; lastError: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; lastRequestId: string | null; dualPane?: boolean }) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showQuickFintheonModal] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  // Skill-aware send — activates skill and prepends prefix before sending
  const handleSkillSend = useCallback((skillId: string, msg: string) => {
    setActiveSkill(skillId);
    const prefix = SKILL_PREFIXES[skillId] || '';
    const finalText = prefix ? `${prefix}\n\n${msg}` : msg;
    runtime.append({ role: 'user', content: [{ type: 'text', text: finalText }] });
  }, [runtime]);

  // Listen for external open-chat-skill events (e.g. from Regime Tracker AI Generate)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.skillId && detail?.prompt) {
        handleSkillSend(detail.skillId, detail.prompt);
      }
    };
    window.addEventListener('fintheon:open-chat-skill', handler);
    return () => window.removeEventListener('fintheon:open-chat-skill', handler);
  }, [handleSkillSend]);

  const handleNewChat = useCallback(() => {
    clearConversationId();
  }, [clearConversationId]);

  const handleTakeNote = useCallback(async (messageId: string, content: string) => {
    try {
      await fetch(`${API_BASE}/api/context-bank/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'harper-opus',
          memoryType: 'observation',
          content: content.slice(0, 500),
          metadata: {
            source: 'take-note',
            messageId,
            conversationId,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      console.error('[TakeNote] Failed to save:', err);
    }
  }, [conversationId]);

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        onRunMDB={() => handleSend('Run the MDB report')}
        onNewChat={handleNewChat}
        onSelectSession={(id) => setConversationId(id)}
        onNewSession={handleNewChat}
        currentConversationId={conversationId}
        isLoading={isRunning}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <FintheonThread
            onSend={handleSend}
            isLoading={isRunning}
            agentName={activeAgent?.name}
            onTakeNote={handleTakeNote}
            messageRefs={messageRefs}
            lastError={lastError}
            lastRequestId={lastRequestId}
          />
          {/* Fade-to-black gradient above composer */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10" style={{ height: '140px', background: 'linear-gradient(to bottom, transparent, var(--fintheon-bg))' }} />
          <div className="relative z-20 shrink-0">
          <FintheonComposer
            thinkHarder={thinkHarder}
            setThinkHarder={setThinkHarder}
            lastError={lastError}
            activeSkill={activeSkill}
            onSelectSkill={setActiveSkill}
            showSkills={showSkills}
            onToggleSkills={() => setShowSkills((v) => !v)}
            disabledSkills={disabledSkills}
          />
          </div>
        </div>

        {/* Preview pane — right side, only in dual-pane mode (Chat main) */}
        {dualPane && showArtifacts && (
          <div className="flex-shrink-0 w-96 border-l border-[var(--fintheon-accent)]/15 transition-[width] duration-[240ms] ease-in-out overflow-hidden">
            <div className="w-96 h-full flex flex-col bg-[var(--fintheon-surface)]">
              <div className="h-14 border-b border-[var(--fintheon-accent)]/15 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--fintheon-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-wide">Preview</h2>
                </div>
                <button onClick={() => setShowArtifacts(false)} className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors">
                  <X className="w-4 h-4 text-[var(--fintheon-accent)]/70" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {/* Preview content renders here when Harper-Opus creates artifacts */}
              </div>
            </div>
          </div>
        )}

      </div>

      <QuickFintheonModal isOpen={showQuickFintheonModal} onClose={() => {}} onAnalysisComplete={() => {}} />
    </div>
  );
}

export default function ChatInterface({ surfaceId = 'analysis' }: { surfaceId?: string }) {
  const { activeAgent } = useFintheonAgents();
  const [thinkHarderState, setThinkHarderState] = useState(false);
  const { runtime, conversationId, setConversationId, clearConversationId, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarderState, surfaceId);

  // Chat main surface gets dual-pane layout (conversation + artifacts)
  const isDualPane = surfaceId === 'chat';

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatInterfaceInner conversationId={conversationId} setConversationId={setConversationId} clearConversationId={clearConversationId} lastError={lastError} thinkHarder={thinkHarderState} setThinkHarder={setThinkHarderState} lastRequestId={lastRequestId} dualPane={isDualPane} />
    </AssistantRuntimeProvider>
  );
}
