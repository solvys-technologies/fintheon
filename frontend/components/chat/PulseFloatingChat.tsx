// [claude-code 2026-03-13] Hermes migration: useOpenClawRuntime -> useHermesRuntime
// [claude-code 2026-03-10] Migrated to useHermesRuntime + AssistantRuntimeProvider + PulseThread + PulseComposer
import { useState, useCallback } from 'react';
import { MessageSquare, X, Maximize2 } from 'lucide-react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { usePulseAgents } from '../../contexts/PulseAgentContext';
import { useHermesRuntime } from './useHermesRuntime';
import { PulseThread } from './PulseThread';
import { PulseComposer } from './PulseComposer';

interface PulseFloatingChatProps {
  visible: boolean;
  onExpandToAnalysis: () => void;
}

/* Inner component — must be inside AssistantRuntimeProvider */
function FloatingInner({
  onExpandToAnalysis,
  onCollapse,
  lastError,
  lastRequestId,
  thinkHarder,
  setThinkHarder,
}: {
  onExpandToAnalysis: () => void;
  onCollapse: () => void;
  lastError: string | null;
  lastRequestId: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
}) {
  const { activeAgent } = usePulseAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);

  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback((msg: string) => {
    runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
  }, [runtime]);

  return (
    <div
      className="fixed z-[90] flex flex-col rounded-xl border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] shadow-2xl overflow-hidden"
      style={{ bottom: '24px', right: '24px', width: '380px', height: '560px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-md bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] font-semibold"
            style={{ width: '24px', height: '24px', fontSize: '12px' }}
          >
            {activeAgent?.icon || 'H'}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-white">{activeAgent?.name || 'Harper'}</div>
            <div className="text-[10px] text-gray-500">{activeAgent?.sector || 'Chief Analyst'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { onCollapse(); onExpandToAnalysis(); }}
            className="flex items-center justify-center rounded-md text-gray-500 hover:text-[var(--fintheon-accent)] transition-colors"
            style={{ width: '28px', height: '28px' }}
            title="Expand to Analysis"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onCollapse}
            className="flex items-center justify-center rounded-md text-gray-500 hover:text-white transition-colors"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Thread (compact variant — no greeting, no cognition panel) */}
      <PulseThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact
      />

      {/* Composer (compact mode — fewer toolbar buttons) */}
      <PulseComposer
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
        lastError={lastError}
        activeSkill={activeSkill}
        onSelectSkill={setActiveSkill}
        showSkills={showSkills}
        onToggleSkills={() => setShowSkills((v) => !v)}
        compact
      />
    </div>
  );
}

export function PulseFloatingChat({ visible, onExpandToAnalysis }: PulseFloatingChatProps) {
  const [expanded, setExpanded] = useState(false);
  const [thinkHarder, setThinkHarder] = useState(true);
  const { activeAgent } = usePulseAgents();

  const { runtime, lastError, lastRequestId } = useHermesRuntime(
    activeAgent?.id ?? 'default',
    thinkHarder,
    'floating'
  );

  if (!visible) return null;

  /* Collapsed state — 48x48 pill */
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed z-[90] flex items-center justify-center rounded-full bg-[var(--fintheon-accent)] text-black hover:bg-[#C5A030] transition-all shadow-lg hover:shadow-xl"
        style={{ bottom: '24px', right: '24px', width: '48px', height: '48px' }}
        title="Open chat"
      >
        <MessageSquare size={20} />
      </button>
    );
  }

  /* Expanded state — wrapped in runtime provider */
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <FloatingInner
        onExpandToAnalysis={onExpandToAnalysis}
        onCollapse={() => setExpanded(false)}
        lastError={lastError}
        lastRequestId={lastRequestId ?? null}
        thinkHarder={thinkHarder}
        setThinkHarder={setThinkHarder}
      />
    </AssistantRuntimeProvider>
  );
}
