// [claude-code 2026-03-13] Hermes migration: useOpenClawRuntime -> useHermesRuntime
// [claude-code 2026-03-10] Simplified ChatInterface — removed unused state, added AiLoader
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AlertTriangle, CalendarCheck, X, Bookmark, Trash2 } from 'lucide-react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { usePulseAgents } from '../contexts/PulseAgentContext';
import { useHermesRuntime } from './chat/useHermesRuntime';
import { ChatHeader } from './chat/ChatHeader';
import { PulseThread, AiLoader } from './chat/PulseThread';
import { PulseComposer } from './chat/PulseComposer';
import { SKILL_PREFIXES } from '../lib/skillPrefixes';
import QuickPulseModal from './analysis/QuickPulseModal';
import { addCheckpoint, deleteCheckpoint, listCheckpoints, type ChatCheckpoint } from '../lib/chatCheckpoints';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

function usePanelState(key: string, defaultValue: boolean): [boolean, (v: boolean | ((p: boolean) => boolean)) => void] {
  const [state, setState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  const setAndPersist = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [key]);

  return [state, setAndPersist];
}

function groupCheckpointsByDate(items: ChatCheckpoint[]): { label: string; items: ChatCheckpoint[] }[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  const groups: Record<string, ChatCheckpoint[]> = {};
  const order: string[] = [];
  for (const cp of items) {
    const d = new Date(cp.createdAt).toDateString();
    const label = d === todayStr ? 'Today' : d === yesterdayStr ? 'Yesterday' : d;
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(cp);
  }
  return order.map((label) => ({ label, items: groups[label] }));
}

function ChatInterfaceInner({ conversationId, clearConversationId, lastError, thinkHarder, setThinkHarder, lastRequestId }: { conversationId: string | undefined; clearConversationId: () => void; lastError: string | null; thinkHarder: boolean; setThinkHarder: (v: boolean) => void; lastRequestId: string | null }) {
  const { activeAgent } = usePulseAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const { disabledSkills } = useFeatureFlags();
  const [showCheckpoints, setShowCheckpoints] = usePanelState('pulse:panel:checkpoints', false);
  const [checkpointVersion, setCheckpointVersion] = useState(0);
  const [showQuickPulseModal] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const checkpointItems = useMemo<ChatCheckpoint[]>(
    () => listCheckpoints(conversationId),
    [conversationId, showCheckpoints, checkpointVersion]
  );

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
    window.addEventListener('pulse:open-chat-skill', handler);
    return () => window.removeEventListener('pulse:open-chat-skill', handler);
  }, [handleSkillSend]);

  const handleNewChat = useCallback(() => {
    clearConversationId();
  }, [clearConversationId]);

  const createCheckpointFromMessage = useCallback((messageId: string, content: string) => {
    if (!conversationId) return;
    const trimmed = (content || '').trim();
    const excerpt = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
    const title = (excerpt.split('\n')[0] || 'Checkpoint').slice(0, 64);
    addCheckpoint({ conversationId, messageId, title, excerpt });
    setCheckpointVersion((v) => v + 1);
    setShowCheckpoints(true);
  }, [conversationId, setShowCheckpoints]);

  const jumpToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        onRunMDB={() => handleSend('Run the MDB report')}
        onNewChat={handleNewChat}
        onToggleCheckpoints={() => setShowCheckpoints((v) => !v)}
        showCheckpoints={showCheckpoints}
        isLoading={isRunning}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <PulseThread
            onSend={handleSend}
            isLoading={isRunning}
            agentName={activeAgent?.name}
            onCheckpoint={createCheckpointFromMessage}
            messageRefs={messageRefs}
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
            disabledSkills={disabledSkills}
          />
        </div>

        {/* Checkpoints sidebar */}
        <div className={`flex-shrink-0 overflow-hidden transition-[width] duration-[240ms] ease-in-out ${showCheckpoints ? 'w-80' : 'w-0'} border-l border-[var(--fintheon-accent)]/20`}>
          <div className="w-80 h-full flex flex-col bg-[var(--fintheon-surface)]">
            <div className="h-14 border-b border-[var(--fintheon-accent)]/20 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[var(--fintheon-accent)]" />
                <h2 className="text-base font-semibold text-[var(--fintheon-accent)] tracking-wide">Checkpoints</h2>
              </div>
              <button onClick={() => setShowCheckpoints(false)} className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors">
                <X className="w-4 h-4 text-[var(--fintheon-accent)]/70" />
              </button>
            </div>
            <div className="px-4 py-2.5 border-b border-white/5">
              <p className="text-[11px] text-zinc-500 leading-snug">Bookmark key moments — hover any assistant reply and tap the checkpoint icon.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {!conversationId ? (
                <div className="text-center text-zinc-500 text-sm py-8">Start a chat to create checkpoints.</div>
              ) : checkpointItems.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
                  <CalendarCheck className="w-8 h-8 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No checkpoints yet.</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">Hover an assistant message and click the <span className="text-[var(--fintheon-accent)]/80">checkpoint</span> icon to save it here.</p>
                </div>
              ) : (
                groupCheckpointsByDate(checkpointItems).map((group) => (
                  <div key={group.label} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fintheon-accent)]/50">{group.label}</span>
                      <div className="flex-1 h-px bg-[var(--fintheon-accent)]/10" />
                      <span className="text-[10px] text-zinc-600">{group.items.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map((cp) => (
                        <div
                          key={cp.id}
                          className="group relative w-full p-2.5 bg-zinc-900/40 border border-zinc-800/80 hover:border-[var(--fintheon-accent)]/30 hover:bg-zinc-900/70 rounded-lg transition-all cursor-pointer"
                          onClick={() => jumpToMessage(cp.messageId)}
                        >
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">{new Date(cp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-sm text-zinc-200 font-medium truncate">{cp.title}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed pl-[calc(10px+0.5rem)]">{cp.excerpt}</p>
                          <div className="mt-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-[calc(10px+0.5rem)]">
                            <button onClick={(e) => { e.stopPropagation(); jumpToMessage(cp.messageId); }} className="px-2 py-0.5 bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] rounded text-[11px] font-medium hover:bg-[var(--fintheon-accent)]/25 transition-colors">Jump</button>
                            <button onClick={(e) => { e.stopPropagation(); deleteCheckpoint(cp.id); setCheckpointVersion((v) => v + 1); }} className="ml-auto p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"><Trash2 className="w-3 h-3 text-zinc-600 hover:text-[var(--fintheon-accent)]" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            {checkpointItems.length > 0 && (
              <div className="px-4 py-2 border-t border-white/5 text-[10px] text-zinc-600 text-center">
                {checkpointItems.length} checkpoint{checkpointItems.length !== 1 ? 's' : ''} saved
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickPulseModal isOpen={showQuickPulseModal} onClose={() => {}} onAnalysisComplete={() => {}} />
    </div>
  );
}

export default function ChatInterface() {
  const { activeAgent } = usePulseAgents();
  const [thinkHarderState, setThinkHarderState] = useState(true);
  const { runtime, conversationId, clearConversationId, lastError, lastRequestId } = useHermesRuntime(activeAgent?.id ?? 'default', thinkHarderState, 'analysis');

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatInterfaceInner conversationId={conversationId} clearConversationId={clearConversationId} lastError={lastError} thinkHarder={thinkHarderState} setThinkHarder={setThinkHarderState} lastRequestId={lastRequestId} />
    </AssistantRuntimeProvider>
  );
}
