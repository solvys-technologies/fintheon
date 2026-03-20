// [claude-code 2026-03-16] Hermes settings tab — moved from standalone HermesCommandCenter page into Settings
// [claude-code 2026-03-20] Added startup config section — backend autostart + launch-on-login toggles
import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Eye, EyeOff, CheckCircle2, XCircle, Power, Monitor } from 'lucide-react';
import { useGateway } from '../../contexts/GatewayContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useFintheonAgents } from '../../contexts/FintheonAgentContext';
import { HermesAgentCards } from '../hermes/HermesAgentCards';
import { HermesActivityLog, useActivityLog } from '../hermes/HermesActivityLog';
import { isElectron } from '../../lib/platform';

/* ------------------------------------------------------------------ */
/*  Section header                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--fintheon-accent)]">
        {title}
      </h3>
      <div className="flex-1 border-t border-[var(--fintheon-accent)]/15" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function HermesSettings() {
  const { status, lastHealthCheck, reconnect, gatewayUrl } = useGateway();
  const { gatewayPort } = useSettings();
  const { agents } = useFintheonAgents();
  const { entries } = useActivityLog();
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  // Startup config (Electron only)
  const [backendAutostart, setBackendAutostart] = useState(true);
  const [launchOnLogin, setLaunchOnLogin] = useState(false);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [backendToggling, setBackendToggling] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;
    window.electron?.getStartupConfig().then((cfg) => {
      setBackendAutostart(cfg.backendAutostart);
      setLaunchOnLogin(cfg.launchOnLogin);
    });
    window.electron?.isBackendAlive().then((res) => setBackendAlive(res.alive));
  }, []);

  const handleToggleAutostart = useCallback(async (enabled: boolean) => {
    setBackendAutostart(enabled);
    await window.electron?.setStartupConfig({ backendAutostart: enabled });
  }, []);

  const handleToggleLaunchOnLogin = useCallback(async (enabled: boolean) => {
    setLaunchOnLogin(enabled);
    await window.electron?.setStartupConfig({ launchOnLogin: enabled });
  }, []);

  const handleStartBackend = useCallback(async () => {
    setBackendToggling(true);
    await window.electron?.startBackend();
    // Give it a moment to spin up
    setTimeout(async () => {
      const res = await window.electron?.isBackendAlive();
      setBackendAlive(res?.alive ?? false);
      setBackendToggling(false);
    }, 2000);
  }, []);

  const handleStopBackend = useCallback(async () => {
    setBackendToggling(true);
    await window.electron?.stopBackend();
    setTimeout(async () => {
      const res = await window.electron?.isBackendAlive();
      setBackendAlive(res?.alive ?? false);
      setBackendToggling(false);
    }, 1000);
  }, []);

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

  const statusColor =
    status === 'connected' ? 'text-emerald-400' : status === 'connecting' ? 'text-yellow-400' : 'text-red-400';
  const statusLabel =
    status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';

  return (
    <div className="space-y-6">
      {/* 0. Startup & Backend Process (Electron only) */}
      {isElectron() && (
        <section>
          <SectionHeader title="Startup & Backend" />
          <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 space-y-4">
            {/* Backend process status + manual control */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${backendAlive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-[11px] text-zinc-300">
                  Backend Process {backendAlive ? '(Running)' : '(Stopped)'}
                </span>
              </div>
              <button
                onClick={backendAlive ? handleStopBackend : handleStartBackend}
                disabled={backendToggling}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-40 ${
                  backendAlive
                    ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                    : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                }`}
              >
                <Power className={`w-3 h-3 ${backendToggling ? 'animate-spin' : ''}`} />
                {backendAlive ? 'Stop' : 'Start'}
              </button>
            </div>

            {/* Auto-start backend toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-zinc-300">Auto-start backend on app launch</div>
                <div className="text-[10px] text-zinc-600">
                  Spawns the Hono backend when Fintheon opens
                </div>
              </div>
              <button
                onClick={() => handleToggleAutostart(!backendAutostart)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  backendAutostart ? 'bg-[var(--fintheon-accent)]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    backendAutostart ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>

            {/* Launch on login toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                  <Monitor className="w-3 h-3 text-zinc-500" />
                  Launch Fintheon on login
                </div>
                <div className="text-[10px] text-zinc-600">
                  Opens the app automatically when you sign into your Mac
                </div>
              </div>
              <button
                onClick={() => handleToggleLaunchOnLogin(!launchOnLogin)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  launchOnLogin ? 'bg-[var(--fintheon-accent)]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    launchOnLogin ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 1. Gateway Status Card */}
      <section>
        <SectionHeader title="Gateway Status" />
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Gateway Status</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected'
                    ? 'bg-emerald-500'
                    : status === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono">{gatewayUrl}</div>
          <div className="text-[10px] text-zinc-600">Port: {gatewayPort}</div>
          {lastHealthCheck && (
            <div className="text-[10px] text-zinc-600">
              Last check: {new Date(lastHealthCheck).toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={reconnect}
            className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)] hover:text-[var(--fintheon-accent)]/80 transition-colors mt-1"
          >
            <RefreshCw className="w-3 h-3" /> Reconnect
          </button>
        </div>
      </section>

      {/* 2. OpenRouter API Key */}
      <section>
        <SectionHeader title="OpenRouter API Key" />
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">API Key</span>
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-[11px] text-zinc-300 font-mono">{showKey ? apiKey || '(not set)' : maskedKey}</div>
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
          <p className="text-[10px] text-zinc-600">
            To change the API key, update <code className="text-zinc-400">VITE_OPENROUTER_API_KEY</code> in your{' '}
            <code className="text-zinc-400">.env</code> file and restart the dev server.
          </p>
        </div>
      </section>

      {/* 3. Agent Status Cards */}
      <section>
        <SectionHeader title="Agent Status" />
        <HermesAgentCards agents={agents} />
      </section>

      {/* 4. Activity Log (last 10 requests) */}
      <section>
        <SectionHeader title="Recent Activity" />
        <div className="h-[280px] rounded-lg border border-[var(--fintheon-accent)]/20 overflow-hidden bg-[var(--fintheon-bg)] p-3">
          <HermesActivityLog entries={entries} />
        </div>
      </section>
    </div>
  );
}
