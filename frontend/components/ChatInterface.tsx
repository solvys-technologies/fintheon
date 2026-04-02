// [claude-code 2026-03-29] S9-T5: Replace checkpoint sidebar with real conversation history, Take Note button
// [claude-code 2026-03-28] S8-T7: Dual-pane layout (left=conversation, right=artifacts) for Chat
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Layers, Clock, Loader2 } from 'lucide-react';
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

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
  isArchived: boolean;
}

function ChatInterfaceInner({ conversationId, setConversationId, clearConversationId, lastError, thinkHarder, setThinkHarder, lastRequestId, dualPane = false }: { conversationId: string | undefined; setConversationId: (id: string) => void; clearConversationId: () => void; lastError: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; lastRequestId: string | null; dualPane?: boolean }) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showQuickFintheonModal] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch conversations when sessions panel opens
  useEffect(() => {
    if (!showSessions) return;
    setSessionsLoading(true);
    fetch(`${API_BASE}/api/ai/conversations`)
      .then(r => r.json())
      .then(data => setSessions(data.conversations ?? []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [showSessions]);

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
        onToggleSessions={() => setShowSessions((v) => !v)}
        showSessions={showSessions}
        isLoading={isRunning}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <FintheonThread
            onSend={handleSend}
            isLoading={isRunning}
            agentName={activeAgent?.name}
            onTakeNote={handleTakeNote}
            messageRefs={messageRefs}
            lastError={lastError}
            lastRequestId={lastRequestId}
          />
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

        {/* Sessions sidebar */}
        <div className={`flex-shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-in-out ${showSessions ? 'w-80' : 'w-0'} border-l border-[var(--fintheon-accent)]/20`}>
          <div className="w-80 h-full flex flex-col bg-[var(--fintheon-surface)]">
            <div className="h-12 border-b border-[var(--fintheon-accent)]/15 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--fintheon-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-wide">Sessions</h2>
              </div>
              <button onClick={() => setShowSessions(false)} className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors">
                <X className="w-4 h-4 text-[var(--fintheon-accent)]/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--fintheon-accent)]/40" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center text-zinc-600 text-[11px] py-8 px-4">
                  No sessions yet. Start a conversation.
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setConversationId(session.id);
                      setShowSessions(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
                      conversationId === session.id ? 'bg-[var(--fintheon-accent)]/10' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-[var(--fintheon-text)] font-medium truncate">
                        {session.title}
                      </span>
                      <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums">
                        {new Date(session.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-zinc-600">{session.messageCount} messages</span>
                      {session.model && (
                        <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono">{session.model}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-white/5 text-[9px] text-zinc-600 text-center">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
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
