// [claude-code 2026-03-16] Hermes Command Center: agent status, settings, chat, activity log
import { useState, useCallback, useEffect } from 'react';
import { AssistantRuntimeProvider, useThread, useThreadRuntime } from '@assistant-ui/react';
import { Cpu, RefreshCw, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { useGateway } from '../../contexts/GatewayContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useHermesRuntime } from '../chat/useHermesRuntime';
import { FintheonThread } from '../chat/FintheonThread';
import { FintheonComposer } from '../chat/FintheonComposer';
import { HermesAgentCards } from './HermesAgentCards';
import { HermesActivityLog, useActivityLog } from './HermesActivityLog';

/* ------------------------------------------------------------------ */
/*  Section header                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--fintheon-accent)]">
        {title}
      </h2>
      <div className="flex-1 border-t border-[var(--fintheon-accent)]/15" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2: Hermes Settings                                          */
/* ------------------------------------------------------------------ */

function HermesSettings() {
  const { status, lastHealthCheck, reconnect, gatewayUrl } = useGateway();
  const { gatewayPort } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '';
  const maskedKey = apiKey ? apiKey.slice(0, 8) + '...' + apiKey.slice(-4) : '(not set)';

  const handleTestKey = useCallback(async () => {
    setTestResult(null);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      setTestResult(res.ok ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    }
  }, [apiKey]);

  const statusColor = status === 'connected' ? 'text-emerald-400' : status === 'connecting' ? 'text-yellow-400' : 'text-red-400';
  const statusLabel = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Gateway status */}
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">Gateway Status</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono">{gatewayUrl}</div>
        <div className="text-[10px] text-zinc-600">Port: {gatewayPort}</div>
        {lastHealthCheck && (
          <div className="text-[10px] text-zinc-600">Last check: {new Date(lastHealthCheck).toLocaleTimeString()}</div>
        )}
        <button
          onClick={reconnect}
          className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)] hover:text-[var(--fintheon-accent)]/80 transition-colors mt-1"
        >
          <RefreshCw className="w-3 h-3" /> Reconnect
        </button>
      </div>

      {/* API Key + Model */}
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">OpenRouter API Key</span>
          <button onClick={() => setShowKey(!showKey)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="text-[11px] text-zinc-300 font-mono">
          {showKey ? (apiKey || '(not set)') : maskedKey}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestKey}
            disabled={!apiKey}
            className="text-[10px] px-2 py-0.5 rounded border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Test Key
          </button>
          {testResult === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {testResult === 'fail' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
        </div>
        <div className="text-[10px] text-zinc-600 mt-1">
          Default Model: <span className="text-zinc-400 font-mono">anthropic/claude-opus-4-6</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3: Chat Inner (inside AssistantRuntimeProvider)             */
/* ------------------------------------------------------------------ */

function HermesChatInner({
  lastError,
  lastRequestId,
  thinkHarder,
  setThinkHarder,
  onMessageSent,
}: {
  lastError: string | null;
  lastRequestId: string | null;
  thinkHarder: boolean;
  setThinkHarder: (v: boolean) => void;
  onMessageSent: (text: string) => void;
}) {
  const { activeAgent } = useFintheonAgents();
  const runtime = useThreadRuntime();
  const isRunning = useThread((t) => t.isRunning);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [showSkills, setShowSkills] = useState(false);

  const handleSend = useCallback(
    (msg: string) => {
      runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
      onMessageSent(msg);
    },
    [runtime, onMessageSent],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FintheonThread
        onSend={handleSend}
        isLoading={isRunning}
        agentName={activeAgent?.name}
        lastError={lastError}
        lastRequestId={lastRequestId}
        compact
      />
      <FintheonComposer
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

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function HermesCommandCenter() {
  const { agents, activeAgent, setActiveAgent } = useFintheonAgents();
  const [thinkHarder, setThinkHarder] = useState(false);
  const { entries, logActivity } = useActivityLog();

  const { runtime, lastError, lastRequestId } = useHermesRuntime(
    activeAgent?.id ?? 'default',
    thinkHarder,
    'hermes-command',
  );

  const handleMessageSent = useCallback(
    (text: string) => {
      logActivity(activeAgent?.name ?? 'Unknown', 'chat', text);
    },
    [activeAgent, logActivity],
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <Cpu className="w-5 h-5 text-[var(--fintheon-accent)]" />
        <h1 className="text-base font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">
          Hermes Command Center
        </h1>
      </div>

      {/* Section 1: Agent Status */}
      <section>
        <SectionHeader title="Agent Status" />
        <HermesAgentCards agents={agents} />
      </section>

      {/* Section 2: Settings */}
      <section>
        <SectionHeader title="Hermes Settings" />
        <HermesSettings />
      </section>

      {/* Section 3: Chat + Section 4: Activity — side by side */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <SectionHeader title="Chat Interface" />
          {/* Agent selector */}
          <div className="mb-2">
            <select
              value={activeAgent?.id ?? ''}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) setActiveAgent(found);
              }}
              className="text-[11px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded px-2 py-1 text-[var(--fintheon-text)] focus:outline-none focus:border-[var(--fintheon-accent)]/50"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.sector})
                </option>
              ))}
            </select>
          </div>
          <div className="h-[420px] rounded-lg border border-[var(--fintheon-accent)]/20 overflow-hidden bg-[var(--fintheon-bg)]">
            <AssistantRuntimeProvider runtime={runtime}>
              <HermesChatInner
                lastError={lastError}
                lastRequestId={lastRequestId ?? null}
                thinkHarder={thinkHarder}
                setThinkHarder={setThinkHarder}
                onMessageSent={handleMessageSent}
              />
            </AssistantRuntimeProvider>
          </div>
        </div>

        <div className="flex flex-col">
          <SectionHeader title="Activity Log" />
          <div className="h-[420px] rounded-lg border border-[var(--fintheon-accent)]/20 overflow-hidden bg-[var(--fintheon-bg)] p-3">
            <HermesActivityLog entries={entries} />
          </div>
        </div>
      </section>
    </div>
  );
}
