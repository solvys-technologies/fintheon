// [claude-code 2026-03-13] Hermes migration: OpenClaw Gateway -> Hermes Agent in UI text
// [claude-code 2026-03-11] T2e: persistent thread toggle in Gateway tab
// [claude-code 2026-03-11] T5: added mic device selector to notifications tab
import React from 'react';
import { Settings, Bell, CreditCard, Cpu, Code, Volume2, Terminal, Wifi, Palette, Users, AlertTriangle, ArrowLeft, Globe, Mic } from 'lucide-react';
import { useSettings, type APIKeys } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useGateway } from '../contexts/GatewayContext';
import Toggle from './Toggle';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import { useBackend } from '../lib/backend';
import { HEALING_BOWL_SOUNDS, healingBowlPlayer } from '../utils/healingBowlSounds';
import { useVoiceMemory } from '../hooks/useVoiceMemory';

import { ClawnalystDesk } from './settings/ClawnalystDesk';
import { ThemeSettings } from './settings/ThemeSettings';

type SettingsTab = 'general' | 'gateway' | 'appearance' | 'desk' | 'notifications' | 'trading' | 'api' | 'iframes' | 'developer' | 'danger';

export function SettingsPage() {
  const { tier, setTier, isAuthenticated } = useAuth();
  const {
    apiKeys,
    setAPIKeys,
    tradingModels,
    setTradingModels,
    alertConfig,
    setAlertConfig,
    mockDataEnabled,
    setMockDataEnabled,
    selectedSymbol,
    setSelectedSymbol,
    riskSettings,
    setRiskSettings,
    developerSettings,
    setDeveloperSettings,
    autoPilotSettings,
    setAutoPilotSettings,
    primaryBroker,
    setPrimaryBroker,
    iframeUrls,
    setIframeUrls,
    traderName,
    setTraderName,
  } = useSettings();
  const backend = useBackend();
  const voiceMemory = useVoiceMemory();
  const [contractsPerTrade, setContractsPerTrade] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [showLanding, setShowLanding] = useState(true);

  const handleTabChange = (tab: SettingsTab) => {
    if (!showLanding && tab === activeTab && !tabTransitioning) return;
    setShowLanding(false);
    if (tab === activeTab) return;
    setTabTransitioning(true);
    setPrevTab(activeTab);
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => {
        setTabTransitioning(false);
        setPrevTab(null);
      }, 50);
    }, 300);
  };

  const handleBackToLanding = () => {
    setShowLanding(true);
  };

  const availableSymbols = [
    {
      symbol: 'MNQ',
      contractName: 'MNQ Z25',
      description: 'E-mini Micro Nasdaq Futures'
    },
    {
      symbol: 'ES',
      contractName: 'ES Z25',
      description: 'E-mini S&P 500 Futures'
    },
    {
      symbol: 'NQ',
      contractName: 'NQ Z25',
      description: 'E-mini Nasdaq-100 Futures'
    },
    {
      symbol: 'YM',
      contractName: 'YM Z25',
      description: 'E-mini Dow Jones Futures'
    },
    {
      symbol: 'RTY',
      contractName: 'RTY Z25',
      description: 'E-mini Russell 2000 Futures'
    },
  ];

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [prevTab, setPrevTab] = useState<SettingsTab | null>(null);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Sync to backend only when authenticated
      if (isAuthenticated) {
        await backend.account.updateSettings({
          dailyTarget: riskSettings.dailyProfitTarget,
          dailyLossLimit: riskSettings.dailyLossLimit,
          topstepxUsername: apiKeys.topstepxUsername,
          topstepxApiKey: apiKeys.topstepxApiKey,
          selectedSymbol: selectedSymbol.symbol,
          contractsPerTrade: contractsPerTrade,
        });

        if (apiKeys.topstepxUsername || apiKeys.topstepxApiKey) {
          await backend.account.updateProjectXCredentials({
            username: apiKeys.topstepxUsername || undefined,
            apiKey: apiKeys.topstepxApiKey || undefined,
          });
        }
      }

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load account settings and credentials when component mounts
  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchData() {
      try {
        const account = await backend.account.get();

        // Load contracts settings
        if (account.contractsPerTrade) {
          setContractsPerTrade(account.contractsPerTrade);
        }

        // Load credentials if present
        if (account.projectxUsername) {
          setAPIKeys((prev: APIKeys) => ({
            ...prev,
            topstepxUsername: account.projectxUsername || '',
          }));
        }
      } catch (error) {
        console.warn('Failed to load settings data:', error);
      }
    }

    fetchData();
  }, [backend, isAuthenticated, setAPIKeys]);

  const tabs = [
    { id: 'general' as const, label: 'Profile', icon: Settings, description: 'Trading symbol, billing, and account preferences' },
    { id: 'gateway' as const, label: 'Hermes', icon: Wifi, description: 'Hermes agent connection and health status' },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette, description: 'Theme and visual customization options' },
    { id: 'desk' as const, label: 'Clawnalyst Desk', icon: Users, description: 'Configure analyst personas and agent settings' },
    { id: 'trading' as const, label: 'Trading', icon: Cpu, description: 'Risk management, autopilot, and strategy toggles' },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell, description: 'Alerts, sounds, and notification preferences' },
    { id: 'api' as const, label: 'API', icon: Code, description: 'API keys and external service credentials' },
    { id: 'iframes' as const, label: 'iFrames', icon: Globe, description: 'Notion embed URLs for Boardroom, Research, and more' },
    { id: 'developer' as const, label: 'Developer', icon: Terminal, description: 'Mock data, test tools, and tier management' },
    { id: 'danger' as const, label: 'Danger Zone', icon: AlertTriangle, description: 'Reset analysts, clear data, and export config' },
  ];

  return (
    <div className="h-full w-full flex relative">
      {/* Main content — stretches full width */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* ===== LANDING PAGE ===== */}
        {showLanding ? (
          <div className="flex-1 overflow-y-auto px-8 py-8 flex items-center justify-center">
            <div className="max-w-3xl w-full">
              <div className="text-center mb-8">
                <h1 className="text-[22px] font-semibold text-white tracking-tight mb-1">Settings</h1>
                <p className="text-[13px] text-gray-500">Configure your Fintheon environment</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isDanger = tab.id === 'danger';
                  return (
                    <React.Fragment key={tab.id}>
                      {/* Spacer before Danger Zone — pushes it to row 4, col 2 */}
                      {isDanger && <div className="hidden lg:block" />}
                      <button
                        onClick={() => handleTabChange(tab.id)}
                        className={`group text-left p-4 rounded-lg border transition-all hover:scale-[1.01] ${
                          isDanger
                            ? 'border-red-500/15 hover:border-red-500/30 hover:bg-red-500/5'
                            : 'pulse-accent-border pulse-accent-border-hover'
                        }`}
                        style={{ backgroundColor: 'rgba(10,10,0,0.4)' }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isDanger
                              ? 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20'
                              : 'pulse-settings-icon'
                          } transition-colors`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-[13px] font-semibold ${isDanger ? 'text-red-400' : 'text-white'}`}>
                              {tab.label}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
        /* ===== SUBSECTION CONTENT ===== */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Back button + section title */}
          <div className="shrink-0 flex items-center gap-3 px-8 pt-5 pb-3">
            <button
              onClick={handleBackToLanding}
              className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
              title="Back to Settings"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {(() => { const Icon = tabs.find(t => t.id === activeTab)?.icon ?? Settings; return <Icon className="w-4 h-4 text-[var(--fintheon-accent)]/60" />; })()}
              <h2 className="text-[14px] font-semibold text-white tracking-tight">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 space-y-6 relative">
            {activeTab === 'notifications' && (
              <div key="notifications" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Alert Configuration</h3>
                  <div className="space-y-3">
                    <Toggle
                      label="Price Alerts"
                      enabled={alertConfig.priceAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, priceAlerts: val })}
                    />
                    <Toggle
                      label="Psychological Alerts"
                      enabled={alertConfig.psychAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, psychAlerts: val })}
                    />
                    <Toggle
                      label="News Alerts"
                      enabled={alertConfig.newsAlerts}
                      onChange={(val) => setAlertConfig({ ...alertConfig, newsAlerts: val })}
                    />
                    <Toggle
                      label="Sound Enabled"
                      enabled={alertConfig.soundEnabled}
                      onChange={(val) => setAlertConfig({ ...alertConfig, soundEnabled: val })}
                    />
                    <Toggle
                      label="Nametag Emotional Pulse"
                      enabled={alertConfig.nametagPulse ?? true}
                      onChange={(val) => setAlertConfig({ ...alertConfig, nametagPulse: val })}
                    />
                  </div>
                </section>

                <section className="pt-6">
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Healing Bowl Sound</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Select a sound to play when emotional tilt is detected. Calm sounds are relaxing, shock sounds are alerting.
                  </p>
                  <div className="space-y-2">
                    {HEALING_BOWL_SOUNDS.map((sound) => (
                      <div
                        key={sound.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${alertConfig.healingBowlSound === sound.id
                          ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40'
                          : 'bg-[var(--fintheon-surface)] border-zinc-800 hover:border-zinc-700'
                          }`}
                        onClick={() => setAlertConfig({ ...alertConfig, healingBowlSound: sound.id })}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{sound.name}</span>
                            <span
                              className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${sound.type === 'calm'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                }`}
                            >
                              {sound.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{sound.description}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            healingBowlPlayer.preview(sound.id);
                          }}
                          className="ml-3 p-2 rounded-lg bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/20 transition-colors"
                          title="Preview sound"
                        >
                          <Volume2 className="w-4 h-4 text-[var(--fintheon-accent)]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3 flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Microphone Device
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Select which microphone to use for voice commands. Changes apply on next voice session.
                  </p>
                  <select
                    value={voiceMemory.micDeviceId ?? ''}
                    onChange={(e) => voiceMemory.setMicDeviceId(e.target.value || null)}
                    className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
                  >
                    <option value="">System Default</option>
                    {voiceMemory.devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone (${device.deviceId.slice(0, 8)}...)`}
                      </option>
                    ))}
                  </select>
                  {voiceMemory.devices.length === 0 && (
                    <p className="text-[11px] text-zinc-600 mt-2">
                      No microphones detected. Grant microphone permission to see devices.
                    </p>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'trading' && (
              <div key="trading" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">Risk Management</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Profit Target</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={riskSettings.dailyProfitTarget}
                          onChange={(e) => setRiskSettings({ ...riskSettings, dailyProfitTarget: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Target profit amount per trading day
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Loss Limit</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={riskSettings.dailyLossLimit}
                          onChange={(e) => setRiskSettings({ ...riskSettings, dailyLossLimit: parseFloat(e.target.value) || 0 })}
                          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Maximum loss amount per trading day
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Contracts Per Trade</h4>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={contractsPerTrade}
                          onChange={(e) => setContractsPerTrade(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          className="flex-1 bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Number of contracts the algorithm will use per trade. Stop loss is automatically calculated to ensure $330 total risk per trade.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Over-Trading Monitor</h4>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Max Trades</label>
                          <select
                            value={riskSettings.maxTrades || 5}
                            onChange={(e) => setRiskSettings({ ...riskSettings, maxTrades: parseInt(e.target.value) })}
                            className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Duration</label>
                          <select
                            value={riskSettings.overTradingDuration || 15}
                            onChange={(e) => setRiskSettings({ ...riskSettings, overTradingDuration: parseInt(e.target.value) })}
                            className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                          >
                            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(min => (
                              <option key={min} value={min}>{min} min</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Maximum number of trades allowed within the specified duration window
                      </p>
                    </div>
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h2 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-4">Autopilot</h2>

                  <div className="space-y-6">
                    {/* Primary broker (execution) */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Primary broker</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPrimaryBroker('rithmic')}
                          className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                            primaryBroker === 'rithmic'
                              ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                              : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                          }`}
                        >
                          Rithmic (primary)
                        </button>
                        <button
                          onClick={() => setPrimaryBroker('projectx')}
                          className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                            primaryBroker === 'projectx'
                              ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                              : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                          }`}
                        >
                          ProjectX
                        </button>
                        <button
                          onClick={() => setPrimaryBroker('hyperliquid')}
                          className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                            primaryBroker === 'hyperliquid'
                              ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]'
                              : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700 text-gray-400'
                          }`}
                        >
                          Hyperliquid (perps)
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Autopilot execution uses the selected broker. Rithmic for futures, ProjectX for sim, Hyperliquid for crypto perps.
                      </p>
                    </div>

                    {/* Broker connection info */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Broker Status</h4>
                      <div className="bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg p-4 text-sm text-gray-400 space-y-1">
                        <p><span className="text-gray-500">Rithmic:</span> Gateway sidecar on localhost:3002</p>
                        <p><span className="text-gray-500">ProjectX:</span> TopStepX API</p>
                        <p><span className="text-gray-500">Hyperliquid:</span> Wallet auth — set HYPERLIQUID_PRIVATE_KEY in backend .env</p>
                      </div>
                    </div>

                    {/* AutoPilot Mode Selector */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Autopilot Mode</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'off', label: 'Off', desc: 'Manual trading only' },
                          { value: 'semi', label: 'Semi-Auto', desc: 'Proposals require approval' },
                          { value: 'autonomous', label: 'Autonomous', desc: 'Auto-execute trades' },
                        ].map(mode => (
                          <button
                            key={mode.value}
                            onClick={() => setAutoPilotSettings({ 
                              ...autoPilotSettings, 
                              mode: mode.value as 'off' | 'semi' | 'autonomous',
                              requireConfirmation: mode.value !== 'autonomous'
                            })}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              autoPilotSettings.mode === mode.value
                                ? 'bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/40'
                                : 'bg-[var(--fintheon-bg)] border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className={`text-sm font-medium ${autoPilotSettings.mode === mode.value ? 'text-[var(--fintheon-accent)]' : 'text-white'}`}>
                              {mode.label}
                            </div>
                            <div className="text-[10px] text-gray-500">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                      {autoPilotSettings.mode === 'autonomous' && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                          ⚠️ Autonomous mode will execute trades automatically without confirmation
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Price Action Strategies</h4>
                      <div className="space-y-3">
                        <Toggle
                          label="Morning Flush"
                          enabled={tradingModels.morningFlush}
                          onChange={(val) => setTradingModels({ ...tradingModels, morningFlush: val })}
                        />
                        <Toggle
                          label="Lunch/Power Hour Flush"
                          enabled={tradingModels.lunchPowerHourFlush}
                          onChange={(val) => setTradingModels({ ...tradingModels, lunchPowerHourFlush: val })}
                        />
                        <Toggle
                          label="40/40 Club"
                          enabled={tradingModels.fortyFortyClub}
                          onChange={(val) => setTradingModels({ ...tradingModels, fortyFortyClub: val })}
                        />
                        <Toggle
                          label="Momentum Model"
                          enabled={tradingModels.momentumModel}
                          onChange={(val) => setTradingModels({ ...tradingModels, momentumModel: val })}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Volatility Strategies</h4>
                      <div className="space-y-3">
                        <Toggle
                          label="22 VIX Fix"
                          enabled={tradingModels.vixFixer}
                          onChange={(val) => setTradingModels({ ...tradingModels, vixFixer: val })}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Risk Event-Based Strategies</h4>
                      <div className="space-y-3">
                        <Toggle
                          label="Charged Up Rippers"
                          enabled={tradingModels.chargedUpRippers}
                          onChange={(val) => setTradingModels({ ...tradingModels, chargedUpRippers: val })}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Mean Reversion</h4>
                      <div className="space-y-3">
                        <Toggle
                          label="Mean Reversion Model"
                          enabled={tradingModels.meanReversionModel}
                          onChange={(val) => setTradingModels({ ...tradingModels, meanReversionModel: val })}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Enable or disable specific trading models for your algorithmic strategy
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'general' && (
              <div key="general" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Trader Identity</h3>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Trader Name</label>
                    <input
                      type="text"
                      value={traderName}
                      onChange={(e) => setTraderName(e.target.value.slice(0, 24))}
                      maxLength={24}
                      placeholder="Enter your name"
                      className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--fintheon-accent)]/30 transition-colors"
                    />
                    <p className="text-[10px] text-gray-500 mt-1.5">Displayed in the toolbar next to your tier badge</p>
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Trading Symbol</h3>
                  <div className="relative">
                    {(() => {
                      const symbolKey = selectedSymbol.symbol.replace('/', '');
                      const selected = availableSymbols.find(s => s.symbol === symbolKey) || availableSymbols[0];
                      return (
                        <>
                          <button
                            onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                            className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-4 py-3 text-left hover:border-[var(--fintheon-accent)]/30 focus:outline-none focus:border-[var(--fintheon-accent)]/30 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-white">{selected.symbol}</div>
                                <div className="text-xs text-gray-400">{selected.contractName}</div>
                                <div className="text-xs text-gray-500">{selected.description}</div>
                              </div>
                              <svg className="w-5 h-5 text-gray-400 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {showSymbolDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowSymbolDropdown(false)}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                                {availableSymbols.map(sym => {
                                  const isSelected = sym.symbol === symbolKey;
                                  return (
                                    <button
                                      key={sym.symbol}
                                      onClick={() => {
                                        setSelectedSymbol({
                                          symbol: `/${sym.symbol}`,
                                          contractName: `/${sym.contractName.replace(' ', '')}`,
                                        });
                                        setShowSymbolDropdown(false);
                                      }}
                                      className={`w-full text-left px-4 py-3 hover:bg-[var(--fintheon-accent)]/10 transition-colors border-b border-zinc-800 last:border-b-0 ${isSelected ? 'bg-[var(--fintheon-accent)]/20' : ''
                                        }`}
                                    >
                                      <div className="text-sm font-bold text-white">{sym.symbol}</div>
                                      <div className="text-xs text-gray-400">{sym.contractName}</div>
                                      <div className="text-xs text-gray-500">{sym.description}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </section>

                <section className="pt-6 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Billing</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Current Plan</h4>
                      <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-lg font-bold text-[var(--fintheon-accent)]">{tier.replace('_', ' ').toUpperCase()}</p>
                            <p className="text-xs text-gray-500">Active subscription</p>
                          </div>
                          <Button variant="secondary" className="text-xs">
                            Change Plan
                          </Button>
                        </div>
                        <div className="text-sm text-gray-400">
                          <p>Next billing date: <span className="text-white">Jan 4, 2026</span></p>
                          <p className="mt-1">Amount: <span className="text-white">$149.00</span></p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Payment Method</h4>
                      <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm text-white">•••• •••• •••• 4242</p>
                              <p className="text-xs text-gray-500">Expires 12/2027</p>
                            </div>
                          </div>
                          <Button variant="secondary" className="text-xs">
                            Update
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Billing History</h4>
                      <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg overflow-hidden">
                        {[
                          { date: 'Dec 4, 2025', amount: '$149.00', status: 'Paid' },
                          { date: 'Nov 4, 2025', amount: '$149.00', status: 'Paid' },
                          { date: 'Oct 4, 2025', amount: '$149.00', status: 'Paid' },
                        ].map((invoice, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 last:border-b-0 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                          >
                            <div>
                              <p className="text-sm text-white">{invoice.date}</p>
                              <p className="text-xs text-gray-500">{invoice.status}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-semibold text-white">{invoice.amount}</p>
                              <button className="text-xs text-[var(--fintheon-accent)] hover:underline">
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-red-500 mb-3">Danger Zone</h4>
                      <div className="bg-[var(--fintheon-bg)] border border-red-500/30 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-3">
                          Cancel your subscription. You will retain access until the end of your billing period.
                        </p>
                        <Button variant="secondary" className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10">
                          Cancel Subscription
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'api' && (
              <div key="api" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">TopstepX Credentials</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Username</label>
                      <input
                        type="text"
                        value={apiKeys.topstepxUsername || ''}
                        onChange={(e) => setAPIKeys({ ...apiKeys, topstepxUsername: e.target.value })}
                        placeholder="Enter your TopstepX username"
                        className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">API Key</label>
                      <input
                        type="password"
                        value={apiKeys.topstepxApiKey || ''}
                        onChange={(e) => setAPIKeys({ ...apiKeys, topstepxApiKey: e.target.value })}
                        placeholder="Enter your TopstepX API key"
                        className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Sign up at <a href="https://topstepx.com" target="_blank" rel="noopener noreferrer" className="text-[var(--fintheon-accent)] hover:underline">topstepx.com</a> and contact support for API access
                    </p>
                  </div>
                </section>

                <p className="text-xs text-gray-500 mt-4">
                  Agent inference uses OpenRouter (set OPENROUTER_API_KEY in backend <code className="bg-zinc-800 px-1 rounded">backend-hono/.env</code>). Voice Engine uses OpenAI (set OPENAI_API_KEY in backend). See SETUP.md for details.
                </p>
              </div>
            )}

            {activeTab === 'iframes' && (
              <div key="iframes" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">iFrames</h3>
                  <p className="text-xs text-gray-500 mb-4">Set Notion page URLs for embedded views. Leave blank to use defaults from environment variables.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Boardroom URL</label>
                      <input
                        type="url"
                        value={iframeUrls.boardroom}
                        onChange={(e) => setIframeUrls({ ...iframeUrls, boardroom: e.target.value })}
                        placeholder={import.meta.env.VITE_NOTION_BOARDROOM_URL || 'https://www.notion.so/your-boardroom-page'}
                        className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-gray-600">Embedded in the Board Room tab</p>
                        <button
                          onClick={() => window.open(iframeUrls.boardroom || import.meta.env.VITE_NOTION_BOARDROOM_URL || '', '_blank')}
                          className="text-[11px] font-medium text-[var(--fintheon-accent)] hover:underline"
                        >
                          Login with Google
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Research URL</label>
                      <input
                        type="url"
                        value={iframeUrls.research}
                        onChange={(e) => setIframeUrls({ ...iframeUrls, research: e.target.value })}
                        placeholder={import.meta.env.VITE_NOTION_RESEARCH_URL || 'https://www.notion.so/your-research-page'}
                        className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 placeholder:text-zinc-600"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-gray-600">Embedded in the Research tab and preloaded browser</p>
                        <button
                          onClick={() => window.open(iframeUrls.research || import.meta.env.VITE_NOTION_RESEARCH_URL || '', '_blank')}
                          className="text-[11px] font-medium text-[var(--fintheon-accent)] hover:underline"
                        >
                          Login with Google
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'gateway' && (
              <div key="gateway" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <GatewayTab />
              </div>
            )}

            {activeTab === 'appearance' && (
              <div key="appearance" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <ThemeSettings />
              </div>
            )}

            {activeTab === 'desk' && (
              <div key="desk" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <ClawnalystDesk />
              </div>
            )}

            {activeTab === 'danger' && (
              <div key="danger" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-red-500 mb-3">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white mb-1">Reset Analysts</h4>
                      <p className="text-xs text-gray-500 mb-3">Restore all analysts to their default configuration.</p>
                      <Button variant="secondary" className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10">Reset to Defaults</Button>
                    </div>
                    <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white mb-1">Clear All Data</h4>
                      <p className="text-xs text-gray-500 mb-3">Remove all conversations, drafts, and local settings. This cannot be undone.</p>
                      <Button variant="secondary" className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10">Clear Data</Button>
                    </div>
                    <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white mb-1">Export Configuration</h4>
                      <p className="text-xs text-gray-500 mb-3">Download your agent and settings configuration as JSON.</p>
                      <Button variant="secondary" className="text-xs text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/10">Export</Button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'developer' && (
              <div key="developer" className={tabTransitioning && prevTab ? 'animate-fade-out-tab' : 'animate-fade-in-tab'}>
                <section>
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Account Tier</h3>
                  <div className="flex gap-2">
                    {(['free', 'pulse', 'pulse_plus', 'pulse_pro'] as const).map(t => (
                      <Button
                        key={t}
                        variant={tier === t ? 'primary' : 'secondary'}
                        onClick={() => setTier(t)}
                        className="text-xs"
                      >
                        {t.replace('_', ' ').toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="pt-6">
                  <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">Developer Settings</h3>
                  <div className="space-y-3">
                    <Toggle
                      label="Enable Mock Data Feed"
                      enabled={mockDataEnabled}
                      onChange={setMockDataEnabled}
                    />
                    <p className="text-xs text-gray-500">
                      Generates simulated market data and news items for testing
                    </p>
                    <Toggle
                      label="Show Test Trade Button"
                      enabled={developerSettings.showTestTradeButton}
                      onChange={(val) => setDeveloperSettings({ ...developerSettings, showTestTradeButton: val })}
                    />
                    <p className="text-xs text-gray-500">
                      Display test trade button for firing mock market orders to TopstepX
                    </p>
                    <Toggle
                      label="Show Mock Proposal Trigger"
                      enabled={developerSettings.showMockProposal}
                      onChange={(val) => setDeveloperSettings({ ...developerSettings, showMockProposal: val })}
                    />
                    <p className="text-xs text-gray-500">
                      Show a button on the Tape to trigger a mock trading proposal for UX testing
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Sticky save bar */}
          <div className="sticky bottom-0 bg-[var(--fintheon-bg)] backdrop-blur-sm border-t border-[var(--fintheon-accent)]/10 px-8 py-3">
            {saveMessage && (
              <div className={`mb-3 px-4 py-2 rounded text-sm ${saveMessage.includes('success')
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                {saveMessage}
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button variant="primary" onClick={handleSave} className="px-6 py-2" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Right-side hover sidebar for subsections — only when inside a section */}
      {!showLanding && (
      <div
        className="absolute right-0 top-0 bottom-0 z-30"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        {/* Hover trigger strip (always visible) */}
        {!sidebarHovered && (
          <div className="absolute right-0 top-0 bottom-0 w-3 bg-transparent cursor-pointer">
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
              {tabs.map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    tabs[i].id === activeTab ? 'h-4 bg-[var(--fintheon-accent)]' : 'h-1.5 bg-[var(--fintheon-accent)]/25'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Expanded sidebar */}
        <div
          className={`h-full bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-accent)]/15 flex flex-col py-5 transition-all duration-200 ease-out overflow-hidden ${
            sidebarHovered ? 'w-52 opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <div className="px-4 mb-4">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-semibold">Subsections</span>
          </div>
          <div className="flex-1 space-y-0.5 px-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    isActive
                      ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                      : 'text-gray-400 hover:bg-[var(--fintheon-accent)]/8 hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className={`text-[12px] font-medium truncate ${isActive ? 'text-[var(--fintheon-accent)]' : ''}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gateway settings tab                                               */
/* ------------------------------------------------------------------ */

// [claude-code 2026-03-11] T2e: persistent thread toggle + thread ID input
function GatewayTab() {
  const { status, lastHealthCheck, reconnect, gatewayUrl } = useGateway();
  const statusColor = status === 'connected' ? '#34D399' : status === 'connecting' ? 'var(--fintheon-accent)' : '#EF4444';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const [persistentEnabled, setPersistentEnabled] = useState(() =>
    localStorage.getItem('pulse_gateway_persistent_thread_enabled') === 'true'
  );
  const [persistentThreadId, setPersistentThreadId] = useState(() =>
    localStorage.getItem('pulse_gateway_persistent_thread_id') ?? ''
  );

  const handleTogglePersistent = (enabled: boolean) => {
    setPersistentEnabled(enabled);
    localStorage.setItem('pulse_gateway_persistent_thread_enabled', String(enabled));
  };

  const handleThreadIdChange = (id: string) => {
    setPersistentThreadId(id);
    localStorage.setItem('pulse_gateway_persistent_thread_id', id);
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-4">Hermes Agent</h3>
      <div className="space-y-4">
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor }} />
              <span className="text-sm font-medium text-white">{statusLabel}</span>
            </div>
            <button
              onClick={reconnect}
              className="text-xs text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 rounded px-3 py-1 hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            >
              Reconnect
            </button>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>URL: <span className="text-gray-400">{gatewayUrl}</span></p>
            {lastHealthCheck && (
              <p>Last health check: <span className="text-gray-400">{new Date(lastHealthCheck).toLocaleTimeString()}</span></p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Hermes connects Fintheon to OpenRouter (Nous subscription) for Claude Opus 4.6 inference. Health checks run every 30 seconds.
        </p>

        {/* Persistent Thread */}
        <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg p-4 mt-4">
          <h4 className="text-sm font-medium text-white mb-3">Persistent Thread</h4>
          <div className="space-y-3">
            <Toggle
              label="Enable persistent thread"
              enabled={persistentEnabled}
              onChange={handleTogglePersistent}
            />
            <div>
              <label className="block text-xs text-gray-400 mb-1">Thread / Conversation ID</label>
              <input
                type="text"
                value={persistentThreadId}
                onChange={(e) => handleThreadIdChange(e.target.value)}
                disabled={!persistentEnabled}
                placeholder="e.g. conv_abc123..."
                className={`w-full bg-[var(--fintheon-bg)] border rounded px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none transition-colors ${
                  persistentEnabled
                    ? 'border-[var(--fintheon-accent)]/30 focus:border-[var(--fintheon-accent)]/60'
                    : 'border-gray-700/30 opacity-50 cursor-not-allowed'
                }`}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Keep a single conversation thread across refreshes. Prevents new-conversation flicker.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
